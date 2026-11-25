import { http } from 'msw'
import { serviceUrl } from '@/lib/env'
import { db, mutate, notify, uid, type DB, type MPayment } from '../db'
import { appOrigin, body, err, json, latency, now, paged, requireRole, serviceKeyError } from './common'

const base = serviceUrl('s5')

/** Idempotent per refType + refId, like the real S5. */
export function createPayment(
  d: DB,
  p: Pick<MPayment, 'refType' | 'refId' | 'payerId' | 'amount' | 'method' | 'label'>,
): MPayment {
  const existing = d.payments.find((x) => x.refType === p.refType && x.refId === p.refId)
  if (existing) return existing
  const payment: MPayment = {
    id: uid(),
    ...p,
    status: 'PENDING',
    createdAt: now(),
    ...(p.method === 'SANDBOX' && {
      token: uid().replace(/-/g, ''),
      expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
    }),
  }
  d.payments.unshift(payment)
  return payment
}

function settle(d: DB, pay: MPayment, status: 'PAID' | 'FAILED') {
  pay.status = status
  if (status === 'PAID') pay.paidAt = now()
  // Callback to S2 / S4 and notification through S6
  notify(
    d,
    pay.payerId,
    `PAYMENT_${status}`,
    status === 'PAID' ? 'Payment received' : 'Payment failed',
    status === 'PAID' ? `We received ${pay.amount} DZD.` : 'The payment did not go through. You can try again or pay cash.',
  )
}

function bySession(d: DB, token: string) {
  return d.payments.find((p) => p.token === token)
}

const payUrlOf = (p: MPayment) => (p.token ? `${appOrigin()}/pay/${p.token}` : undefined)

/** v1.1: payUrl only for SANDBOX payments still PENDING. */
const out = (p: MPayment) => {
  const { token: _t, label: _l, expiresAt: _e, ...rest } = p
  return { ...rest, ...(p.method === 'SANDBOX' && p.status === 'PENDING' && p.token ? { payUrl: payUrlOf(p) } : {}) }
}

export const s5Handlers = [
  http.get(`${base}/payments`, async ({ request }) => {
    await latency()
    const g = requireRole(request, 'any')
    if (!g.ok) return g.res
    const sp = new URL(request.url).searchParams
    const refId = sp.get('refId')
    const status = sp.get('status')
    const items = db()
      .payments.filter((p) => g.c.role === 'ADMIN' || p.payerId === g.c.sub || g.c.role === 'SUPPLIER' || g.c.role === 'TOW_DRIVER')
      .filter((p) => !refId || p.refId === refId)
      .filter((p) => !status || p.status === status)
      .map(out)
    return paged(items, request)
  }),

  http.get(`${base}/payments/:id`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, 'any')
    if (!g.ok) return g.res
    const p = db().payments.find((x) => x.id === params.id)
    return p ? json(out(p)) : err(404, 'NOT_FOUND', 'Payment not found')
  }),

  http.get(`${base}/pay/:token`, async ({ params }) => {
    await latency()
    const p = bySession(db(), String(params.token))
    if (!p) return err(404, 'NOT_FOUND', 'Payment session not found')
    if (p.expiresAt && new Date(p.expiresAt).getTime() < Date.now()) return err(410, 'SESSION_EXPIRED', 'This payment link has expired')
    return json({ amount: p.amount, label: p.label ?? 'DriveFix payment', expiresAt: p.expiresAt, demo: true, status: p.status })
  }),

  http.post(`${base}/pay/:token/:result`, async ({ params }) => {
    await latency()
    return mutate((d) => {
      const p = bySession(d, String(params.token))
      if (!p) return err(404, 'NOT_FOUND', 'Payment session not found')
      if (p.expiresAt && new Date(p.expiresAt).getTime() < Date.now()) return err(410, 'SESSION_EXPIRED', 'This payment link has expired')
      if (p.status !== 'PENDING') return err(409, 'STATE_CONFLICT', 'This payment is already settled')
      settle(d, p, params.result === 'succeed' ? 'PAID' : 'FAILED')
      return json(out(p))
    })
  }),

  http.post(`${base}/payments/:id/cash-collected`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['SUPPLIER', 'TOW_DRIVER'])
    if (!g.ok) return g.res
    return mutate((d) => {
      const p = d.payments.find((x) => x.id === params.id)
      if (!p) return err(404, 'NOT_FOUND', 'Payment not found')
      if (p.method !== 'CASH' || p.status !== 'PENDING') return err(409, 'STATE_CONFLICT', 'Only a pending cash payment can be collected')
      settle(d, p, 'PAID')
      return json(out(p))
    })
  }),

  http.post(`${base}/payments/:id/refund`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['ADMIN'])
    if (!g.ok) return g.res
    const b = await body<{ reason: string }>(request)
    if (!b.reason?.trim()) return err(400, 'VALIDATION_ERROR', 'Reason is required', 'reason')
    return mutate((d) => {
      const p = d.payments.find((x) => x.id === params.id)
      if (!p) return err(404, 'NOT_FOUND', 'Payment not found')
      if (p.status !== 'PAID') return err(409, 'STATE_CONFLICT', 'Only a paid payment can be refunded')
      p.status = 'REFUNDED'
      return json(out(p))
    })
  }),
  /** Service-to-service: S2 / S4 create the payment (idempotent per refType + refId). */
  http.post(`${base}/payments`, async ({ request }) => {
    const denied = serviceKeyError(request)
    if (denied) return denied
    const b = await body<Pick<MPayment, 'refType' | 'refId' | 'payerId' | 'amount' | 'method' | 'label'>>(request)
    if (!b.refType || !b.refId || !b.payerId || !Number.isInteger(b.amount) || !b.method)
      return err(400, 'VALIDATION_ERROR', 'refType, refId, payerId, amount (integer DZD) and method are required')
    return mutate((d) => {
      const p = createPayment(d, { refType: b.refType!, refId: b.refId!, payerId: b.payerId!, amount: b.amount!, method: b.method!, label: b.label ?? 'DriveFix payment' })
      return json({ payment: out(p), ...(p.token ? { payUrl: payUrlOf(p) } : {}) }, 201)
    })
  }),
]
