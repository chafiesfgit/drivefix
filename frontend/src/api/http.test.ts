import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '@/lib/auth'
import { asPage, http, isApiError, normalize, request, type ApiError } from './http'

const reply = (body: string | null, status = 200, contentType = 'application/json') =>
  vi.fn(async () => new Response(body, { status, headers: body === null ? {} : { 'Content-Type': contentType } }))

async function failure(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p
  } catch (e) {
    if (isApiError(e)) return e
    throw e
  }
  throw new Error('expected an ApiError')
}

afterEach(() => {
  vi.unstubAllGlobals()
  authStore.logout('manual')
})

describe('normalize: tolerant reading of a teammate service', () => {
  it('treats null as a missing optional field and keeps unknown fields', () => {
    expect(normalize({ id: 'a', payUrl: null, extra: { x: 1 } })).toEqual({ id: 'a', extra: { x: 1 } })
  })
  it('turns numeric strings in number fields into numbers (money stays whole DZD)', () => {
    expect(normalize({ price: '4500', total: '5000.00', lat: '36.75', name: '4500' })).toEqual({ price: 4500, total: 5000, lat: 36.75, name: '4500' })
  })
  it('leaves dates as they are, with or without milliseconds', () => {
    const d = { createdAt: '2026-11-25T14:30:00Z', paidAt: '2026-11-25T14:30:00.123456Z' }
    expect(normalize(d)).toEqual(d)
    expect(Number.isNaN(Date.parse(d.paidAt))).toBe(false)
  })
})

describe('asPage: list envelope', () => {
  it('wraps a bare array', () => expect(asPage([1, 2])).toEqual({ items: [1, 2], page: 1, pageSize: 2, total: 2 }))
  it('fills a missing items array and counters', () => expect(asPage({ page: 2 })).toMatchObject({ items: [], page: 2, total: 0 }))
  it('survives an empty body', () => expect(asPage(undefined).items).toEqual([]))
})

describe('request()', () => {
  it('returns normalized JSON', async () => {
    vi.stubGlobal('fetch', reply(JSON.stringify({ id: 'o1', total: '5000', payUrl: null })))
    expect(await request('s2', '/orders/o1')).toEqual({ id: 'o1', total: 5000 })
  })
  it('lists tolerate a bare array', async () => {
    vi.stubGlobal('fetch', reply(JSON.stringify([{ id: 'n1' }])))
    const page = await http.list<{ items: { id: string }[] }>('s6', '/notifications')
    expect(page.items).toEqual([{ id: 'n1' }])
  })
  it('204 gives undefined', async () => {
    vi.stubGlobal('fetch', reply(null, 204))
    expect(await request('s6', '/notifications/read-all', { method: 'POST' })).toBeUndefined()
  })
  it('an HTML 502 page becomes a typed SERVER error naming the service', async () => {
    vi.stubGlobal('fetch', reply('<html>Bad Gateway</html>', 502, 'text/html'))
    const e = await failure(request('s3', '/mechanics'))
    expect([e.status, e.code, e.service]).toEqual([502, 'SERVER', 's3'])
  })
  it('an empty 404 becomes NOT_FOUND', async () => {
    vi.stubGlobal('fetch', reply('', 404))
    expect((await failure(request('s2', '/parts/x'))).code).toBe('NOT_FOUND')
  })
  it('keeps the contract code and works without "field"', async () => {
    vi.stubGlobal('fetch', reply(JSON.stringify({ error: { code: 'OUT_OF_STOCK', message: 'No stock' } }), 422))
    const e = await failure(request('s2', '/orders', { method: 'POST', body: {} }))
    expect([e.code, e.field, e.message]).toEqual(['OUT_OF_STOCK', undefined, 'No stock'])
  })
  it('a network or CORS failure is NETWORK_ERROR for that service', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    const e = await failure(request('s4', '/dispatch/tows'))
    expect([e.status, e.code, e.service]).toEqual([0, 'NETWORK_ERROR', 's4'])
  })
  it('401 with a token logs the user out', async () => {
    const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '')
    const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u', role: 'DRIVER', approved: true, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
    authStore.login(jwt, { id: 'u', fullName: 'X', phone: '0555000002', role: 'DRIVER', language: 'en', status: 'ACTIVE', approved: true, createdAt: '2026-11-25T00:00:00Z' })
    vi.stubGlobal('fetch', reply(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'no' } }), 401))
    await failure(request('s2', '/orders'))
    expect(authStore.getToken()).toBeNull()
  })
})
