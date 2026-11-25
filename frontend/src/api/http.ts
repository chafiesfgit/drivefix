import { authStore } from '@/lib/auth'
import { serviceUrl, type ServiceId } from '@/lib/env'
import type { ApiErrorBody } from './models'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly field?: string
  /** Which backend answered (or failed to answer): lets the UI name it ("S3 Mechanic is not reachable"). */
  readonly service?: ServiceId

  constructor(status: number, code: string, message: string, field?: string, service?: ServiceId) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.field = field
    this.service = service
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

/** Fired when any call answers 403 NOT_APPROVED: the app sends the user to /pending. */
export const NOT_APPROVED_EVENT = 'df:not-approved'

type Query = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Query
  /** Send the bearer token when logged in (default true). */
  auth?: boolean
  signal?: AbortSignal
  timeoutMs?: number
  /** The answer is a paged list: tolerate a bare array or a missing `items` (contract: { items, page, pageSize, total }). */
  list?: boolean
}

type Opts = Omit<RequestOptions, 'method' | 'body'>

function buildUrl(svc: ServiceId, path: string, query?: Query): string {
  const url = new URL(serviceUrl(svc) + path)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

/** Keys whose value is a number in the contract (money in whole DZD, counts, coordinates). */
const NUMERIC_KEYS = new Set([
  'price', 'amount', 'total', 'deliveryFee', 'unitPrice', 'estimatedPrice', 'fee', 'baseFee', 'perKm',
  'stock', 'qty', 'rating', 'average', 'count', 'page', 'pageSize', 'durationMin', 'warrantyMonths',
  'lat', 'lng', 'pickupLat', 'pickupLng', 'distanceKm', 'secondsLeft', 'etaMinutes', 'offersSent',
])
const NUMERIC_TEXT = /^-?\d+(\.\d+)?$/

/**
 * Tolerant reading of a teammate's JSON: null becomes "missing" (optional fields stay optional),
 * numeric strings in number fields become numbers ("4500" -> 4500), unknown fields are kept and ignored.
 */
export function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (v === null) continue
      out[k] = typeof v === 'string' && NUMERIC_KEYS.has(k) && NUMERIC_TEXT.test(v.trim()) ? Number(v) : normalize(v)
    }
    return out
  }
  return value
}

/** Paged-list envelope, whatever shape came back. */
export function asPage(data: unknown): { items: unknown[]; page: number; pageSize: number; total: number } {
  if (Array.isArray(data)) return { items: data, page: 1, pageSize: data.length, total: data.length }
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const items = Array.isArray(d.items) ? d.items : []
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  return { ...d, items, page: num(d.page, 1), pageSize: num(d.pageSize, items.length || 20), total: num(d.total, items.length) }
}

/** Stable code for an error that came back without the contract's JSON error body (HTML 502 page, empty body...). */
function codeForStatus(status: number): string {
  if (status >= 500) return 'SERVER'
  return ({ 400: 'VALIDATION_ERROR', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'STATE_CONFLICT', 422: 'BUSINESS_RULE', 429: 'RATE_LIMITED' } as Record<number, string>)[status] ?? 'UNKNOWN'
}

export async function request<T>(svc: ServiceId, path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, signal } = opts
  // S6 must never block a flow: short timeout (contract says 2 s server-side).
  const timeoutMs = opts.timeoutMs ?? (svc === 's6' ? 4000 : 15000)
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = auth ? authStore.getToken() : null
  if (token) headers.Authorization = `Bearer ${token}`

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  let res: Response
  try {
    res = await fetch(buildUrl(svc, path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (e) {
    if (signal?.aborted) throw e
    // fetch only rejects on network problems: service down, wrong URL, firewall, or CORS refused.
    throw new ApiError(0, timedOut ? 'TIMEOUT' : 'NETWORK_ERROR', timedOut ? 'Request timed out' : 'Service unreachable', undefined, svc)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }

  const text = res.status === 204 ? '' : await res.text().catch(() => '')
  let data: unknown = undefined
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = undefined
    }
  }

  if (!res.ok) {
    const err = (data as ApiErrorBody | undefined)?.error
    const code = typeof err?.code === 'string' && err.code ? err.code : codeForStatus(res.status)
    const apiError = new ApiError(res.status, code, err?.message || res.statusText || 'Request failed', err?.field ?? undefined, svc)
    // A rejected token means the session is over: log out (the app shows a toast and the guards go to /login).
    if (token && (res.status === 401 || code === 'ACCOUNT_SUSPENDED')) {
      authStore.logout(code === 'ACCOUNT_SUSPENDED' ? 'suspended' : 'expired')
    } else if (token && code === 'NOT_APPROVED' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NOT_APPROVED_EVENT))
    }
    throw apiError
  }
  if (res.status === 204 || data === undefined) return (opts.list ? asPage(undefined) : undefined) as T
  const clean = normalize(data)
  return (opts.list ? asPage(clean) : clean) as T
}

export const http = {
  get: <T>(svc: ServiceId, path: string, opts?: Opts) => request<T>(svc, path, { ...opts, method: 'GET' }),
  /** GET a paged list ({ items, page, pageSize, total }), tolerant of a bare array or a missing `items`. */
  list: <T>(svc: ServiceId, path: string, opts?: Opts) => request<T>(svc, path, { ...opts, method: 'GET', list: true }),
  post: <T>(svc: ServiceId, path: string, body?: unknown, opts?: Opts) =>
    request<T>(svc, path, { ...opts, method: 'POST', body: body ?? {} }),
  put: <T>(svc: ServiceId, path: string, body?: unknown, opts?: Opts) =>
    request<T>(svc, path, { ...opts, method: 'PUT', body: body ?? {} }),
  patch: <T>(svc: ServiceId, path: string, body?: unknown, opts?: Opts) =>
    request<T>(svc, path, { ...opts, method: 'PATCH', body: body ?? {} }),
  del: <T>(svc: ServiceId, path: string, opts?: Opts) => request<T>(svc, path, { ...opts, method: 'DELETE' }),
}

export interface HealthResult {
  ok: boolean
  ms: number
  error?: string
}

/** GET {base}/health (outside /api/v1) with latency, for the status page. */
export async function pingHealth(svc: ServiceId, timeoutMs = 2500): Promise<HealthResult> {
  const base = serviceUrl(svc).replace(/\/api\/v1$/, '')
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  const started = performance.now()
  try {
    const res = await fetch(`${base}/health`, { signal: controller.signal })
    const ms = Math.round(performance.now() - started)
    return res.ok ? { ok: true, ms } : { ok: false, ms, error: `HTTP ${res.status}` }
  } catch (e) {
    const ms = Math.round(performance.now() - started)
    return { ok: false, ms, error: controller.signal.aborted ? `no answer after ${timeoutMs / 1000} s` : e instanceof Error ? e.message : 'unreachable' }
  } finally {
    clearTimeout(t)
  }
}

/** True when {base}/health answers OK. */
export async function checkHealth(svc: ServiceId): Promise<boolean> {
  return (await pingHealth(svc)).ok
}
