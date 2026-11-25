import { http } from 'msw'
import { serviceUrl } from '@/lib/env'
import { shortId } from '@/lib/format'
import { db, mutate, notify, uid, userName, type DB, type MOffer, type MOrder } from '../db'
import { createPayment } from './s5'
import { appOrigin, body, err, json, latency, noContent, now, paged, requireRole, serviceKeyError } from './common'

const base = serviceUrl('s2')

function supplierRating(d: DB, supplierId: string) {
  const r = d.reviews.filter((x) => x.supplierId === supplierId)
  return r.length ? Math.round((r.reduce((s, x) => s + x.rating, 0) / r.length) * 10) / 10 : 4.5
}

function enrichOffer(d: DB, o: MOffer) {
  return { ...o, supplierName: userName(d, o.supplierId), supplierRating: supplierRating(d, o.supplierId) }
}

function enrichOrder(d: DB, o: MOrder) {
  // v1.1: payUrl only for SANDBOX orders still PENDING and not paid yet
  const paid = (d.payments.find((p) => p.refType === 'ORDER' && p.refId === o.id)?.status ?? 'PENDING') !== 'PENDING'
  const { payUrl, ...rest } = o
  return {
    ...rest,
    ...(payUrl && o.status === 'PENDING' && !paid ? { payUrl } : {}),
    items: o.items.map((i) => {
      const offer = d.offers.find((x) => x.id === i.offerId)
      const part = d.parts.find((p) => p.id === offer?.partId)
      return { ...i, partName: i.partName ?? part?.name, supplierName: userName(d, i.supplierId) }
    }),
  }
}

const NEXT: Record<MOrder['status'], MOrder['status'][]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

export const s2Handlers = [
  http.get(`${base}/parts`, async ({ request }) => {
    await latency()
    const sp = new URL(request.url).searchParams
    const q = (sp.get('q') ?? '').toLowerCase().trim()
    const brand = sp.get('brand')
    const category = sp.get('category')
    const vehicle = (sp.get('vehicle') ?? '').toLowerCase().trim()
    const d = db()
    const items = d.parts
      .filter((p) => !q || [p.name, p.brand, p.reference, p.category].some((v) => v?.toLowerCase().includes(q)))
      .filter((p) => !brand || p.brand === brand)
      .filter((p) => !category || p.category === category)
      .filter(
        (p) =>
          !vehicle ||
          p.compatibleVehicles?.some((v) => v.toLowerCase() === 'universal' || vehicle.includes(v.toLowerCase()) || v.toLowerCase().includes(vehicle)),
      )
      .map((p) => {
        const offers = d.offers.filter((o) => o.partId === p.id && o.active)
        return {
          ...p,
          minPrice: offers.length ? Math.min(...offers.map((o) => o.price)) : undefined,
          offersCount: offers.length,
          hasUsed: offers.some((o) => o.condition === 'USED'),
        }
      })
    return paged(items, request)
  }),

  http.get(`${base}/parts/compare`, async ({ request }) => {
    await latency()
    const ids = (new URL(request.url).searchParams.get('ids') ?? '').split(',').filter(Boolean)
    if (ids.length < 1 || ids.length > 3) return err(400, 'VALIDATION_ERROR', 'Pick 1 to 3 offers', 'ids')
    const d = db()
    const items = ids
      .map((id) => d.offers.find((o) => o.id === id))
      .filter((o): o is MOffer => Boolean(o))
      .map((o) => ({ ...enrichOffer(d, o), part: d.parts.find((p) => p.id === o.partId) }))
    return json({ items })
  }),

  http.get(`${base}/parts/:id`, async ({ params }) => {
    await latency()
    const d = db()
    const part = d.parts.find((p) => p.id === params.id)
    if (!part) return err(404, 'NOT_FOUND', 'Part not found')
    const offers = d.offers
      .filter((o) => o.partId === part.id && o.active)
      .sort((a, b) => a.price - b.price)
      .map((o) => enrichOffer(d, o))
    return json({ part, offers })
  }),

  http.get(`${base}/offers`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['SUPPLIER'], true)
    if (!g.ok) return g.res
    const d = db()
    const items = d.offers
      .filter((o) => o.supplierId === g.c.sub)
      .map((o) => ({ ...o, part: d.parts.find((p) => p.id === o.partId) }))
    return paged(items, request)
  }),

  http.post(`${base}/offers`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['SUPPLIER'], true)
    if (!g.ok) return g.res
    const b = await body<MOffer>(request)
    if (!b.partId) return err(400, 'VALIDATION_ERROR', 'Part is required', 'partId')
    if (!Number.isInteger(b.price) || (b.price ?? 0) <= 0) return err(400, 'VALIDATION_ERROR', 'Price must be a positive integer', 'price')
    if (!Number.isInteger(b.stock) || (b.stock ?? -1) < 0) return err(400, 'VALIDATION_ERROR', 'Stock must be a positive integer', 'stock')
    return mutate((d) => {
      if (!d.parts.some((p) => p.id === b.partId)) return err(404, 'NOT_FOUND', 'Part not found', 'partId')
      const offer: MOffer = {
        id: uid(),
        partId: b.partId!,
        supplierId: g.c.sub,
        price: b.price!,
        stock: b.stock!,
        condition: b.condition ?? 'NEW',
        warrantyMonths: b.warrantyMonths ?? 0,
        deliveryWilayas: b.deliveryWilayas ?? [],
        active: true,
      }
      d.offers.push(offer)
      return json(offer, 201)
    })
  }),

  http.patch(`${base}/offers/:id`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['SUPPLIER'], true)
    if (!g.ok) return g.res
    const b = await body<MOffer>(request)
    return mutate((d) => {
      const o = d.offers.find((x) => x.id === params.id)
      if (!o) return err(404, 'NOT_FOUND', 'Offer not found')
      if (o.supplierId !== g.c.sub) return err(403, 'FORBIDDEN', 'Not your offer')
      if (b.price !== undefined && (!Number.isInteger(b.price) || b.price <= 0)) return err(400, 'VALIDATION_ERROR', 'Price must be a positive integer', 'price')
      if (b.stock !== undefined && (!Number.isInteger(b.stock) || b.stock < 0)) return err(400, 'VALIDATION_ERROR', 'Stock must be a positive integer', 'stock')
      Object.assign(o, {
        ...(b.price !== undefined && { price: b.price }),
        ...(b.stock !== undefined && { stock: b.stock }),
        ...(b.warrantyMonths !== undefined && { warrantyMonths: b.warrantyMonths }),
        ...(b.active !== undefined && { active: b.active }),
      })
      return json(o)
    })
  }),

  http.delete(`${base}/offers/:id`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['SUPPLIER'], true)
    if (!g.ok) return g.res
    return mutate((d) => {
      const o = d.offers.find((x) => x.id === params.id)
      if (!o) return err(404, 'NOT_FOUND', 'Offer not found')
      if (o.supplierId !== g.c.sub) return err(403, 'FORBIDDEN', 'Not your offer')
      const open = d.orders.some((ord) => !['DELIVERED', 'CANCELLED'].includes(ord.status) && ord.items.some((i) => i.offerId === o.id))
      if (open) return err(409, 'STATE_CONFLICT', 'This offer is in an open order, deactivate it instead')
      d.offers = d.offers.filter((x) => x !== o)
      return noContent()
    })
  }),

  http.post(`${base}/orders`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['DRIVER'])
    if (!g.ok) return g.res
    const b = await body<{ items: { offerId: string; qty: number }[]; deliveryAddress: string; wilaya: string; paymentMethod: 'CASH' | 'SANDBOX' }>(request)
    if (!b.items?.length) return err(400, 'VALIDATION_ERROR', 'Cart is empty', 'items')
    if (!b.deliveryAddress?.trim()) return err(400, 'VALIDATION_ERROR', 'Delivery address is required', 'deliveryAddress')
    if (!b.wilaya) return err(400, 'VALIDATION_ERROR', 'Wilaya is required', 'wilaya')
    return mutate((d) => {
      const lines = []
      for (const it of b.items!) {
        const offer = d.offers.find((o) => o.id === it.offerId && o.active)
        if (!offer) return err(404, 'NOT_FOUND', 'Offer not found', 'items')
        if (it.qty < 1 || it.qty > offer.stock) return err(422, 'OUT_OF_STOCK', 'Not enough stock for one of the parts', 'items')
        const part = d.parts.find((p) => p.id === offer.partId)
        lines.push({ offerId: offer.id, supplierId: offer.supplierId, qty: it.qty, unitPrice: offer.price, partName: part?.name })
      }
      const fee = (d.deliveryFees.find((f) => f.wilaya === b.wilaya) ?? d.deliveryFees.find((f) => f.wilaya === 'default'))?.fee ?? 1200
      const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
      const order: MOrder = {
        id: uid(),
        driverId: g.c.sub,
        status: 'PENDING',
        paymentMethod: b.paymentMethod ?? 'CASH',
        deliveryAddress: b.deliveryAddress!,
        wilaya: b.wilaya!,
        deliveryFee: fee,
        total: subtotal + fee,
        items: lines,
        createdAt: now(),
      }
      const payment = createPayment(d, {
        refType: 'ORDER',
        refId: order.id,
        payerId: g.c.sub,
        amount: order.total,
        method: order.paymentMethod,
        label: `DriveFix order #${shortId(order.id)}`,
      })
      if (payment.token) order.payUrl = `${appOrigin()}/pay/${payment.token}`
      d.orders.unshift(order)
      notify(d, g.c.sub, 'ORDER_PLACED', 'Order placed', `Order ${shortId(order.id)} was sent to the supplier.`)
      for (const sid of new Set(lines.map((l) => l.supplierId)))
        notify(d, sid, 'ORDER_PLACED', 'New order', `New order ${shortId(order.id)} to confirm.`)
      return json(enrichOrder(d, order), 201)
    })
  }),

  http.get(`${base}/orders`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['DRIVER', 'SUPPLIER', 'ADMIN'])
    if (!g.ok) return g.res
    const status = new URL(request.url).searchParams.get('status')
    const d = db()
    const items = d.orders
      .filter((o) => g.c.role === 'ADMIN' || (g.c.role === 'DRIVER' ? o.driverId === g.c.sub : o.items.some((i) => i.supplierId === g.c.sub)))
      .filter((o) => !status || o.status === status)
      .map((o) => ({ ...enrichOrder(d, o), driverName: userName(d, o.driverId) }))
    return paged(items, request)
  }),

  http.get(`${base}/orders/:id`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['DRIVER', 'SUPPLIER', 'ADMIN'])
    if (!g.ok) return g.res
    const d = db()
    const o = d.orders.find((x) => x.id === params.id)
    if (!o) return err(404, 'NOT_FOUND', 'Order not found')
    const mine = g.c.role === 'ADMIN' || o.driverId === g.c.sub || o.items.some((i) => i.supplierId === g.c.sub)
    if (!mine) return err(403, 'FORBIDDEN', 'Not your order')
    return json({ ...enrichOrder(d, o), driverName: userName(d, o.driverId) })
  }),

  http.patch(`${base}/orders/:id/status`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['DRIVER', 'SUPPLIER', 'ADMIN'])
    if (!g.ok) return g.res
    const b = await body<{ status: MOrder['status']; reason?: string }>(request)
    return mutate((d) => {
      const o = d.orders.find((x) => x.id === params.id)
      if (!o) return err(404, 'NOT_FOUND', 'Order not found')
      const to = b.status!
      if (!NEXT[o.status].includes(to)) return err(409, 'STATE_CONFLICT', `Cannot go from ${o.status} to ${to}`)
      if (g.c.role === 'DRIVER' && !(to === 'CANCELLED' && o.status === 'PENDING')) return err(409, 'STATE_CONFLICT', 'You can only cancel a pending order')
      if (g.c.role === 'SUPPLIER' && !o.items.some((i) => i.supplierId === g.c.sub)) return err(403, 'FORBIDDEN', 'Not your order')
      if (to === 'CONFIRMED') {
        for (const i of o.items) {
          const offer = d.offers.find((x) => x.id === i.offerId)
          if (offer) offer.stock = Math.max(0, offer.stock - i.qty)
        }
      }
      if (to === 'CANCELLED' && o.status === 'CONFIRMED') {
        for (const i of o.items) {
          const offer = d.offers.find((x) => x.id === i.offerId)
          if (offer) offer.stock += i.qty
        }
      }
      o.status = to
      if (b.reason) o.cancelReason = b.reason
      const label = { CONFIRMED: 'confirmed', SHIPPED: 'shipped', DELIVERED: 'delivered', CANCELLED: 'cancelled', PENDING: 'placed' }[to]
      notify(d, o.driverId, `ORDER_${to}`, `Order ${label}`, `Order ${shortId(o.id)} was ${label}.`)
      return json(enrichOrder(d, o))
    })
  }),

  http.post(`${base}/orders/:id/review`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['DRIVER'])
    if (!g.ok) return g.res
    const b = await body<{ rating: number; comment?: string }>(request)
    if (!b.rating || b.rating < 1 || b.rating > 5) return err(400, 'VALIDATION_ERROR', 'Rating 1 to 5', 'rating')
    return mutate((d) => {
      const o = d.orders.find((x) => x.id === params.id && x.driverId === g.c.sub)
      if (!o) return err(404, 'NOT_FOUND', 'Order not found')
      if (o.status !== 'DELIVERED') return err(422, 'BUSINESS_RULE', 'You can review only after delivery')
      if (o.reviewed) return err(409, 'ALREADY_REVIEWED', 'You already reviewed this order')
      o.reviewed = true
      const r = { id: uid(), orderId: o.id, supplierId: o.items[0].supplierId, rating: b.rating!, comment: b.comment, authorName: userName(d, g.c.sub), createdAt: now() }
      d.reviews.unshift(r)
      return json(r)
    })
  }),

  http.get(`${base}/suppliers/:id/reviews`, async ({ params }) => {
    await latency()
    const d = db()
    const items = d.reviews.filter((r) => r.supplierId === params.id)
    const average = items.length ? Math.round((items.reduce((s, r) => s + r.rating, 0) / items.length) * 10) / 10 : 0
    return json({ average, items })
  }),
  /** Service-to-service: S5 reports the result of an online payment. */
  http.post(`${base}/internal/payments/:orderId/result`, async ({ request, params }) => {
    const denied = serviceKeyError(request)
    if (denied) return denied
    const b = await body<{ status: 'PAID' | 'FAILED' }>(request)
    return mutate((d) => {
      const o = d.orders.find((x) => x.id === params.orderId)
      if (!o) return err(404, 'NOT_FOUND', 'Order not found')
      if (b.status === 'PAID') notify(d, o.driverId, 'PAYMENT_PAID', 'Payment received', `Order ${shortId(o.id)} is paid.`)
      return noContent()
    })
  }),
]
