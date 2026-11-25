// --write scenarios: the "Done when" sentence of each service (spec), with real writes on seed ids.
import { randomUUID } from 'node:crypto'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function s1(ctx, { step, expect, ACCOUNTS }) {
  await step('Log in returns { token, user }', async () => {
    await expect('POST /auth/login', { body: { phone: ACCOUNTS.DRIVER, password: 'Password123' }, status: 200 })
  })
  await step('Wrong password -> 401 INVALID_CREDENTIALS', async () => {
    await expect('POST /auth/login', { body: { phone: ACCOUNTS.DRIVER2, password: 'wrong-password-1' }, status: 401, code: 'INVALID_CREDENTIALS' })
    await expect('POST /auth/login', { body: { phone: ACCOUNTS.DRIVER2, password: 'Password123' }, status: 200 }) // resets the counter
  })
  await step('POST /auth/refresh gives a fresh token (v1.1)', async () => {
    const r = await expect('POST /auth/refresh', { token: ctx.tokens.DRIVER, status: 200 })
    if (!r.user?.approved) throw new Error('refresh: user.approved should be true for an active driver')
  })
  await step('Pending supplier keeps approved:false after refresh', async () => {
    const r = await expect('POST /auth/refresh', { token: ctx.tokens.SUPPLIER_PENDING, status: 200 })
    if (r.user?.approved !== false) throw new Error('pending supplier must stay approved:false until an admin approves')
  })
  await step('Forgot password for an unknown number is silent (204)', async () => {
    await expect('POST /auth/forgot-password', { body: { phone: '0799999999' }, status: 204 })
  })
}

async function s2(ctx, { step, expect }) {
  const T = ctx.tokens
  const offerId = ctx.ids.supplierOffer
  const stockOf = async () => {
    const d = await expect('GET /parts/{id}', { path: `/parts/${ctx.ids.part}`, status: 200 })
    return d.offers.find((o) => o.id === offerId)?.stock
  }
  let before
  await step('Find a part (GET /parts?q=brake)', async () => {
    const r = await expect('GET /parts', { query: { q: 'brake', page: 1, pageSize: 10 }, status: 200 })
    if (!r.items.length) throw new Error('search "brake" returned no part: is the seed loaded?')
  })
  await step('Part detail lists offers cheapest first', async () => {
    const d = await expect('GET /parts/{id}', { path: `/parts/${ctx.ids.part}`, status: 200 })
    const prices = d.offers.map((o) => o.price)
    before = d.offers.find((o) => o.id === offerId)?.stock
    if (prices.some((p, i) => i && p < prices[i - 1])) return { status: 'WARN', detail: `prices not sorted: ${prices.join(', ')}`, fix: 'Sort offers by price, cheapest first.' }
  })
  await step('Compare 2 offers', async () => {
    const r = await expect('GET /parts/compare', { query: { ids: ctx.ids.offers.slice(0, 2).join(',') }, status: 200 })
    if (r.items.length !== 2) throw new Error(`compare returned ${r.items.length} items, expected 2`)
  })
  let order
  await step('Driver orders with CASH (201, total computed by the server)', async () => {
    order = await expect('POST /orders', { token: T.DRIVER, body: { items: [{ offerId, qty: 1 }], deliveryAddress: '12 Rue Didouche Mourad, Alger', wilaya: '16', paymentMethod: 'CASH' }, status: 201 })
    if (order.status !== 'PENDING') throw new Error(`new order status is ${order.status}, expected PENDING`)
  })
  if (!order) return
  await step('Supplier confirms (PENDING -> CONFIRMED)', async () => {
    await expect('PATCH /orders/{id}/status', { path: `/orders/${order.id}/status`, token: T.SUPPLIER, body: { status: 'CONFIRMED' }, status: 200 })
  })
  await step('Stock decreased by 1 on confirm', async () => {
    const after = await stockOf()
    if (before === undefined || after !== before - 1) throw Object.assign(new Error(`stock before ${before}, after ${after}`), { fix: 'Reduce stock when the supplier confirms; restore it on cancel.' })
  })
  await step('Driver cannot cancel after CONFIRMED -> 409', async () => {
    await expect('PATCH /orders/{id}/status', { path: `/orders/${order.id}/status`, token: T.DRIVER, body: { status: 'CANCELLED', reason: 'contract check' }, status: 409, code: 'STATE_CONFLICT' })
  })
  await step('Supplier ships (CONFIRMED -> SHIPPED)', async () => {
    await expect('PATCH /orders/{id}/status', { path: `/orders/${order.id}/status`, token: T.SUPPLIER, body: { status: 'SHIPPED' }, status: 200 })
  })
  await step('Quantity above stock -> 422 OUT_OF_STOCK', async () => {
    await expect('POST /orders', { token: T.DRIVER, body: { items: [{ offerId, qty: 99999 }], deliveryAddress: 'Alger', wilaya: '16', paymentMethod: 'CASH' }, status: 422, code: 'OUT_OF_STOCK' })
  })
}

async function s3(ctx, { step, expect, bookingDate }) {
  const T = ctx.tokens
  const date = bookingDate(4)
  let slot
  let booking
  await step(`Free slots for ${date}`, async () => {
    const r = await expect('GET /mechanics/{id}/slots', { path: `/mechanics/${ctx.ids.mechanic}/slots`, query: { date, serviceId: ctx.ids.service }, status: 200 })
    slot = r.slots[0]
    if (!slot) throw new Error(`no free slot on ${date}`)
  })
  if (!slot) return
  await step(`Driver books ${slot}`, async () => {
    booking = await expect('POST /bookings', { token: T.DRIVER, body: { mechanicId: ctx.ids.mechanic, serviceId: ctx.ids.service, date, startTime: slot, place: 'GARAGE', vehicle: 'Golf 7 2016' }, status: 201 })
  })
  if (!booking) return
  await step('Same slot again -> 409 SLOT_TAKEN', async () => {
    await expect('POST /bookings', { token: T.DRIVER2, body: { mechanicId: ctx.ids.mechanic, serviceId: ctx.ids.service, date, startTime: slot, place: 'GARAGE' }, status: 409, code: 'SLOT_TAKEN' })
  })
  for (const to of ['CONFIRMED', 'IN_PROGRESS', 'DONE']) {
    await step(`Mechanic sets ${to}`, async () => {
      await expect('PATCH /bookings/{id}/status', { path: `/bookings/${booking.id}/status`, token: T.MECHANIC, body: { status: to }, status: 200 })
    })
  }
  await step('Driver reviews the DONE booking', async () => {
    await expect('POST /bookings/{id}/review', { path: `/bookings/${booking.id}/review`, token: T.DRIVER, body: { rating: 5, comment: 'Contract check' }, status: 201 })
  })
  await step('Second review -> ALREADY_REVIEWED', async () => {
    await expect('POST /bookings/{id}/review', { path: `/bookings/${booking.id}/review`, token: T.DRIVER, body: { rating: 4 }, status: [409, 422], code: 'ALREADY_REVIEWED' })
  })
}

async function s4(ctx, { step, expect }) {
  const T = ctx.tokens
  let tow
  let offer
  await step('Tow driver goes online and sends a position', async () => {
    await expect('PUT /tow-drivers/me/availability', { token: T.TOW_DRIVER2, body: { available: false }, status: [200, 409] })
    await expect('PUT /tow-drivers/me/availability', { token: T.TOW_DRIVER, body: { available: true }, status: 200 })
    await expect('PUT /tow-drivers/me/position', { token: T.TOW_DRIVER, body: { lat: 36.7538, lng: 3.0588 }, status: 204 })
  })
  await step('Driver sends an SOS (201 SEARCHING)', async () => {
    tow = await expect('POST /tows', { token: T.DRIVER, body: { pickupLat: 36.7372, pickupLng: 3.0865, pickupAddress: 'Contract check, Alger', vehicle: 'Clio 4', issue: 'Flat battery', urgency: 'URGENT' }, status: 201 })
  })
  if (!tow) return
  await step('The tow driver receives the offer (within 30 s)', async () => {
    const until = Date.now() + 35000
    while (Date.now() < until) {
      const res = await ctx.call({ path: '/tow-drivers/me/offer', token: T.TOW_DRIVER })
      if (res.status === 200 && res.json?.requestId === tow.id) {
        offer = res.json
        return { detail: `offer ${offer.id}, ${offer.secondsLeft} s left` }
      }
      if (res.status === 200 && res.json?.id) await ctx.call({ method: 'POST', path: `/tow-offers/${res.json.id}/decline`, token: T.TOW_DRIVER })
      await sleep(1500)
    }
    throw Object.assign(new Error('no offer for this SOS reached the online tow driver'), { fix: 'Offer the nearest available driver as soon as the SOS is created (30 s expiry).' })
  })
  if (!offer) return
  await step('Accept the offer (ASSIGNED)', async () => {
    const r = await expect('POST /tow-offers/{id}/accept', { path: `/tow-offers/${offer.id}/accept`, token: T.TOW_DRIVER, status: 200 })
    if (r.status !== 'ASSIGNED') throw new Error(`status after accept is ${r.status}, expected ASSIGNED`)
  })
  await step('Accept twice -> 409 OFFER_EXPIRED', async () => {
    await expect('POST /tow-offers/{id}/accept', { path: `/tow-offers/${offer.id}/accept`, token: T.TOW_DRIVER, status: 409, code: 'OFFER_EXPIRED' })
  })
  await step('EN_ROUTE then live tracking', async () => {
    await expect('PATCH /tows/{id}/status', { path: `/tows/${tow.id}/status`, token: T.TOW_DRIVER, body: { status: 'EN_ROUTE' }, status: 200 })
    await expect('PUT /tow-drivers/me/position', { token: T.TOW_DRIVER, body: { lat: 36.745, lng: 3.07 }, status: 204 })
    await expect('GET /tows/{id}/track', { path: `/tows/${tow.id}/track`, token: T.DRIVER, status: 200 })
  })
  await step('ARRIVED then COMPLETED', async () => {
    await expect('PATCH /tows/{id}/status', { path: `/tows/${tow.id}/status`, token: T.TOW_DRIVER, body: { status: 'ARRIVED' }, status: 200 })
    await expect('PATCH /tows/{id}/status', { path: `/tows/${tow.id}/status`, token: T.TOW_DRIVER, body: { status: 'COMPLETED' }, status: 200 })
  })
  await step('Illegal move after COMPLETED -> 409', async () => {
    await expect('PATCH /tows/{id}/status', { path: `/tows/${tow.id}/status`, token: T.TOW_DRIVER, body: { status: 'EN_ROUTE' }, status: 409, code: 'STATE_CONFLICT' })
  })
  await step('Guest SOS with a phone, tracked by code, cancelled by the dispatcher', async () => {
    const g = await expect('POST /tows', { body: { pickupLat: 36.75, pickupLng: 3.05, urgency: 'NORMAL', guestPhone: '0661234567' }, status: 201 })
    if (!g.trackingCode) throw new Error('guest SOS must return a trackingCode')
    await expect('GET /tows/{id}', { path: `/tows/${g.id}`, query: { trackingCode: g.trackingCode }, status: 200 })
    await expect('POST /tows/{id}/cancel', { path: `/tows/${g.id}/cancel`, token: T.DISPATCHER, status: 200 })
  })
  await ctx.call({ method: 'PUT', path: '/tow-drivers/me/availability', token: T.TOW_DRIVER, body: { available: false } })
}

async function s5(ctx, { step, expect, ACCOUNTS }) {
  const T = ctx.tokens
  const key = { 'X-Service-Key': ctx.env.SERVICE_KEY }
  const payer = ctx.ids.user(ACCOUNTS.DRIVER)
  const tokenOf = (url) => String(url ?? '').split('/').filter(Boolean).pop()
  let paid
  let payToken
  await step('S2/S4 create a SANDBOX payment -> payUrl', async () => {
    const refId = randomUUID()
    const r = await expect('POST /payments', { headers: key, body: { refType: 'ORDER', refId, payerId: payer, amount: 4500, method: 'SANDBOX', label: 'Contract check' }, status: 201 })
    if (!r.payUrl) throw new Error('SANDBOX payment must return payUrl (frontend route /pay/{token})')
    payToken = tokenOf(r.payUrl)
    paid = r.payment
    const again = await expect('POST /payments', { headers: key, body: { refType: 'ORDER', refId, payerId: payer, amount: 4500, method: 'SANDBOX' }, status: [200, 201] })
    if (again.payment?.id !== paid?.id) throw Object.assign(new Error('creating twice for the same refType+refId made a new payment'), { fix: 'Make POST /payments idempotent per refType + refId.' })
  })
  if (!payToken) return
  await step('Sandbox page data (demo, amount, label)', async () => {
    const s = await expect('GET /pay/{token}', { path: `/pay/${payToken}`, status: 200 })
    if (s.demo !== true) return { status: 'WARN', detail: 'demo should be true ("Demo - no real money")' }
  })
  await step('Succeed -> PAID, again -> 409', async () => {
    const r = await expect('POST /pay/{token}/succeed', { path: `/pay/${payToken}/succeed`, status: 200 })
    if (r.status !== 'PAID') throw new Error(`status is ${r.status}, expected PAID`)
    await expect('POST /pay/{token}/succeed', { path: `/pay/${payToken}/succeed`, status: 409, code: 'STATE_CONFLICT' })
  })
  await step('Admin refunds a PAID payment (reason required)', async () => {
    await expect('POST /payments/{id}/refund', { path: `/payments/${paid.id}/refund`, token: T.ADMIN, body: {}, status: 400 })
    const r = await expect('POST /payments/{id}/refund', { path: `/payments/${paid.id}/refund`, token: T.ADMIN, body: { reason: 'Contract check' }, status: 200 })
    if (r.status !== 'REFUNDED') throw new Error(`status is ${r.status}, expected REFUNDED`)
  })
  await step('Another session fails -> FAILED', async () => {
    const r = await expect('POST /payments', { headers: key, body: { refType: 'TOW', refId: randomUUID(), payerId: payer, amount: 4200, method: 'SANDBOX' }, status: 201 })
    const f = await expect('POST /pay/{token}/fail', { path: `/pay/${tokenOf(r.payUrl)}/fail`, status: 200 })
    if (f.status !== 'FAILED') throw new Error(`status is ${f.status}, expected FAILED`)
  })
  await step('Supplier marks cash collected on the seed order payment', async () => {
    const r = await expect('POST /payments/{id}/cash-collected', { path: `/payments/${ctx.ids.payment}/cash-collected`, token: T.SUPPLIER, status: [200, 409] })
    if (r?.error) return { status: 'WARN', detail: 'already collected (run again after re-seeding)' }
    if (r?.status !== 'PAID') throw new Error(`status is ${r?.status}, expected PAID`)
  })
  await step('Driver sees own payments by refId', async () => {
    await expect('GET /payments', { token: T.DRIVER, query: { page: 1, pageSize: 5 }, status: 200 })
  })
}

async function s6(ctx, { step, expect, ACCOUNTS }) {
  const T = ctx.tokens
  const key = { 'X-Service-Key': ctx.env.SERVICE_KEY }
  const user = ctx.ids.user(ACCOUNTS.DRIVER)
  let n
  await step('S2 creates a notification from a template (201)', async () => {
    n = await expect('POST /notifications', { headers: key, body: { userId: user, type: 'ORDER_CONFIRMED', variables: { orderId: '301' }, language: 'en' }, status: 201 })
  })
  await step('Missing template variable -> 400', async () => {
    await expect('POST /notifications', { headers: key, body: { userId: user, type: 'ORDER_CONFIRMED', variables: {}, language: 'fr' }, status: 400 })
  })
  await step('Bell count for the driver', async () => {
    const c = await expect('GET /notifications/unread-count', { token: T.DRIVER, status: 200 })
    if (!(c.count >= 1)) throw new Error(`unread-count is ${c.count}, expected at least 1`)
  })
  if (n?.id) {
    await step('Another user cannot read it -> 403', async () => {
      await expect('PATCH /notifications/{id}/read', { path: `/notifications/${n.id}/read`, token: T.SUPPLIER, status: [403, 404] })
    })
    await step('Driver marks it read', async () => {
      const r = await expect('PATCH /notifications/{id}/read', { path: `/notifications/${n.id}/read`, token: T.DRIVER, status: 200 })
      if (r.read !== true) throw new Error('read must be true')
    })
  }
  await step('Read all (204)', async () => {
    await expect('POST /notifications/read-all', { token: T.DRIVER, status: 204 })
  })
  const text = `DriveFix contract check ${Date.now()}`
  await step('Mock SMS is saved and visible in the admin SMS log', async () => {
    await expect('POST /sms', { headers: key, body: { phone: '0555000002', text }, status: 200 })
    const log = await expect('GET /admin/sms-log', { token: T.ADMIN, query: { page: 1, pageSize: 20 }, status: 200 })
    if (!log.items.some((i) => i.text === text)) throw new Error('the SMS just sent is not in /admin/sms-log')
  })
}

export const SCENARIOS = { s1, s2, s3, s4, s5, s6 }
