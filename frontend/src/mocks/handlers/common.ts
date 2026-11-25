import { delay, HttpResponse } from 'msw'
import type { Role } from '../db'

export const json = (body: unknown, status = 200) => HttpResponse.json(body as Record<string, unknown>, { status })

export const noContent = () => new HttpResponse(null, { status: 204 })

/** Contract error body: { error: { code, message, field } } */
export const err = (status: number, code: string, message: string, field?: string) =>
  HttpResponse.json({ error: { code, message, ...(field ? { field } : {}) } }, { status })

export function paged<T>(items: T[], request: Request) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20) || 20))
  return json({ items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: items.length })
}

export interface Caller {
  sub: string
  role: Role
  approved: boolean
}

/** Reads the JWT claims (no signature check: this is a mock). */
export function caller(request: Request): Caller | null {
  const h = request.headers.get('Authorization')
  if (!h?.startsWith('Bearer ')) return null
  try {
    const payload = h.slice(7).split('.')[1]
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const data = JSON.parse(decodeURIComponent(escape(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)))))
    if (data.exp && data.exp * 1000 < Date.now()) return null
    return { sub: data.sub, role: data.role, approved: Boolean(data.approved) }
  } catch {
    return null
  }
}

type Guard = { ok: true; c: Caller } | { ok: false; res: Response }

export function requireRole(request: Request, roles: Role[] | 'any', needApproved = false): Guard {
  const c = caller(request)
  if (!c) return { ok: false, res: err(401, 'UNAUTHORIZED', 'Authentication required') }
  if (roles !== 'any' && !roles.includes(c.role)) return { ok: false, res: err(403, 'FORBIDDEN', 'You do not have permission') }
  if (needApproved && !c.approved) return { ok: false, res: err(403, 'NOT_APPROVED', 'Your account is waiting for approval') }
  return { ok: true, c }
}

export async function body<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>
  } catch {
    return {}
  }
}

/** Small realistic latency so loading states are visible (none under Node: the contract self-test). */
export const latency = () => (typeof window === 'undefined' ? Promise.resolve() : delay(180 + Math.random() * 220))

export const now = () => new Date().toISOString()

/**
 * Service-to-service routes need X-Service-Key. In the browser any non-empty key is accepted (the frontend never
 * calls these); the contract self-test sets VITE_SERVICE_KEY to the shared key so wrong keys are refused.
 */
export function serviceKeyError(request: Request): Response | null {
  const sent = request.headers.get('X-Service-Key')
  const expected = import.meta.env.VITE_SERVICE_KEY as string | undefined
  if (!sent || (expected && sent !== expected)) return err(401, 'UNAUTHORIZED', 'Invalid or missing X-Service-Key')
  return null
}

/** Origin of the frontend, for sandbox payment links (the self-test runs without a window). */
export const appOrigin = () => (typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin)
