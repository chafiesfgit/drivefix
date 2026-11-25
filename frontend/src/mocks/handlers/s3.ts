import { http } from 'msw'
import { serviceUrl } from '@/lib/env'
import { db, mutate, notify, uid, userName, type DB, type MBooking, type MMechanic } from '../db'
import { body, err, json, latency, noContent, now, paged, requireRole } from './common'

const base = serviceUrl('s3')

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function rating(d: DB, mechanicId: string, fallback?: number) {
  const r = d.reviews.filter((x) => x.mechanicId === mechanicId)
  if (!r.length) return fallback
  return Math.round((r.reduce((s, x) => s + x.rating, 0) / r.length) * 10) / 10
}

function profileOut(d: DB, m: MMechanic) {
  return { ...m, rating: rating(d, m.userId, m.rating), reviewsCount: d.reviews.filter((r) => r.mechanicId === m.userId).length }
}

/**
 * Free slots 08:00-17:00 (Algerian week: Friday closed). Spec: the slot length is the service's durationMin,
 * a slot must end before closing time and never overlap another booking.
 */
function freeSlots(d: DB, mechanicId: string, date: string, durationMin: number) {
  const day = new Date(`${date}T12:00:00`).getDay()
  if (day === 5) return []
  const taken = d.bookings
    .filter((b) => b.mechanicId === mechanicId && b.date === date && ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status))
    .map((b) => {
      const svc = d.services.find((s) => s.id === b.serviceId)
      return [toMin(b.startTime), toMin(b.startTime) + (svc?.durationMin ?? 60)] as const
    })
  const slots: string[] = []
  const today = new Date().toISOString().slice(0, 10)
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const step = Math.max(15, durationMin)
  for (let m = 8 * 60; m + step <= 17 * 60; m += step) {
    if (date === today && m <= nowMin) continue
    if (taken.some(([a, b]) => m < b && m + step > a)) continue
    slots.push(toTime(m))
  }
  return slots
}

const NEXT: Record<MBooking['status'], MBooking['status'][]> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['DONE'],
  DONE: [],
  REJECTED: [],
  CANCELLED: [],
}

function bookingOut(d: DB, b: MBooking) {
  return {
    ...b,
    serviceName: d.services.find((s) => s.id === b.serviceId)?.name,
    garageName: d.mechanics.find((m) => m.userId === b.mechanicId)?.garageName,
    driverName: userName(d, b.driverId),
    driverPhone: d.users.find((u) => u.id === b.driverId)?.phone,
  }
}

export const s3Handlers = [
  http.get(`${base}/mechanics`, async ({ request }) => {
    await latency()
    const sp = new URL(request.url).searchParams
    const wilaya = sp.get('wilaya')
    const specialty = sp.get('specialty')
    const atClient = sp.get('atClient') === 'true'
    const minRating = Number(sp.get('minRating') ?? 0)
    const d = db()
    const items = d.mechanics
      .map((m) => profileOut(d, m))
      .filter((m) => !wilaya || m.wilaya === wilaya)
      .filter((m) => !specialty || m.specialties?.includes(specialty))
      .filter((m) => !atClient || m.offersMobile)
      .filter((m) => (m.rating ?? 0) >= minRating)
    return paged(items, request)
  }),

  http.get(`${base}/mechanics/me/services`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['MECHANIC'])
    if (!g.ok) return g.res
    return json({ items: db().services.filter((s) => s.mechanicId === g.c.sub) })
  }),

  http.put(`${base}/mechanics/me`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['MECHANIC'], true)
    if (!g.ok) return g.res
    const b = await body<MMechanic>(request)
    if (!b.garageName?.trim()) return err(400, 'VALIDATION_ERROR', 'Garage name is required', 'garageName')
    if (!b.wilaya) return err(400, 'VALIDATION_ERROR', 'Wilaya is required', 'wilaya')
    return mutate((d) => {
      let m = d.mechanics.find((x) => x.userId === g.c.sub)
      if (!m) {
        m = { userId: g.c.sub, garageName: b.garageName!, wilaya: b.wilaya!, offersMobile: false }
        d.mechanics.push(m)
      }
      Object.assign(m, b, { userId: g.c.sub })
      return json(profileOut(d, m))
    })
  }),

  http.post(`${base}/mechanics/me/services`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['MECHANIC'], true)
    if (!g.ok) return g.res
    const b = await body<{ name: string; price: number; durationMin: number }>(request)
    if (!b.name?.trim()) return err(400, 'VALIDATION_ERROR', 'Name is required', 'name')
    if (!Number.isInteger(b.price) || (b.price ?? 0) <= 0) return err(400, 'VALIDATION_ERROR', 'Price must be a positive integer', 'price')
    if (!Number.isInteger(b.durationMin) || (b.durationMin ?? 0) <= 0) return err(400, 'VALIDATION_ERROR', 'Duration must be positive', 'durationMin')
    return mutate((d) => {
      const s = { id: uid(), mechanicId: g.c.sub, name: b.name!, price: b.price!, durationMin: b.durationMin!, active: true }
      d.services.push(s)
      return json(s, 201)
    })
  }),

  http.patch(`${base}/mechanics/me/services/:id`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['MECHANIC'])
    if (!g.ok) return g.res
    const b = await body<{ name: string; price: number; durationMin: number; active: boolean }>(request)
    return mutate((d) => {
      const s = d.services.find((x) => x.id === params.id && x.mechanicId === g.c.sub)
      if (!s) return err(404, 'NOT_FOUND', 'Service not found')
      Object.assign(s, b)
      return json(s)
    })
  }),

  http.delete(`${base}/mechanics/me/services/:id`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['MECHANIC'])
    if (!g.ok) return g.res
    return mutate((d) => {
      const s = d.services.find((x) => x.id === params.id && x.mechanicId === g.c.sub)
      if (!s) return err(404, 'NOT_FOUND', 'Service not found')
      d.services = d.services.filter((x) => x !== s)
      return noContent()
    })
  }),

  http.get(`${base}/mechanics/:id/slots`, async ({ request, params }) => {
    await latency()
    const sp = new URL(request.url).searchParams
    const date = sp.get('date') ?? new Date().toISOString().slice(0, 10)
    const d = db()
    if (!d.mechanics.some((m) => m.userId === params.id)) return err(404, 'NOT_FOUND', 'Mechanic not found')
    // v1.1: ?serviceId= sets the slot length; default = the mechanic's shortest active service
    const active = d.services.filter((s) => s.mechanicId === params.id && s.active)
    const svc = active.find((s) => s.id === sp.get('serviceId'))
    const duration = svc?.durationMin ?? Math.min(...active.map((s) => s.durationMin), 60)
    return json({ date, slots: freeSlots(d, String(params.id), date, duration) })
  }),

  http.get(`${base}/mechanics/:id`, async ({ params }) => {
    await latency()
    const d = db()
    const m = d.mechanics.find((x) => x.userId === params.id)
    if (!m) return err(404, 'NOT_FOUND', 'Mechanic not found')
    return json({
      profile: profileOut(d, m),
      services: d.services.filter((s) => s.mechanicId === m.userId && s.active),
      reviews: d.reviews.filter((r) => r.mechanicId === m.userId),
    })
  }),

  http.post(`${base}/bookings`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['DRIVER'])
    if (!g.ok) return g.res
    const b = await body<MBooking>(request)
    return mutate((d) => {
      const m = d.mechanics.find((x) => x.userId === b.mechanicId)
      const svc = d.services.find((s) => s.id === b.serviceId && s.mechanicId === b.mechanicId && s.active)
      if (!m || !svc) return err(404, 'NOT_FOUND', 'Mechanic or service not found')
      if (!b.date || !b.startTime) return err(400, 'VALIDATION_ERROR', 'Pick a date and a time', 'startTime')
      if (b.place === 'AT_CLIENT' && !m.offersMobile) return err(422, 'BUSINESS_RULE', 'This mechanic does not come to your place', 'place')
      if (b.place === 'AT_CLIENT' && !b.clientAddress?.trim()) return err(400, 'VALIDATION_ERROR', 'Address is required', 'clientAddress')
      if (!freeSlots(d, m.userId, b.date, svc.durationMin).includes(b.startTime)) return err(409, 'SLOT_TAKEN', 'This time was just taken, pick another one', 'startTime')
      const booking: MBooking = {
        id: uid(),
        driverId: g.c.sub,
        mechanicId: m.userId,
        serviceId: svc.id,
        price: svc.price,
        date: b.date,
        startTime: b.startTime,
        place: b.place ?? 'GARAGE',
        clientAddress: b.clientAddress,
        vehicle: b.vehicle,
        note: b.note,
        status: 'PENDING',
        createdAt: now(),
      }
      d.bookings.unshift(booking)
      notify(d, m.userId, 'BOOKING_REQUESTED', 'New booking request', `${svc.name} on ${b.date} at ${b.startTime}.`)
      return json(bookingOut(d, booking), 201)
    })
  }),

  http.get(`${base}/bookings`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['DRIVER', 'MECHANIC'])
    if (!g.ok) return g.res
    const status = new URL(request.url).searchParams.get('status')
    const d = db()
    const items = d.bookings
      .filter((b) => (g.c.role === 'DRIVER' ? b.driverId === g.c.sub : b.mechanicId === g.c.sub))
      .filter((b) => !status || status.split(',').includes(b.status))
      .map((b) => bookingOut(d, b))
    return paged(items, request)
  }),

  http.patch(`${base}/bookings/:id/status`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['DRIVER', 'MECHANIC'])
    if (!g.ok) return g.res
    const b = await body<{ status: MBooking['status']; reason?: string }>(request)
    return mutate((d) => {
      const bk = d.bookings.find((x) => x.id === params.id)
      if (!bk) return err(404, 'NOT_FOUND', 'Booking not found')
      const mine = g.c.role === 'DRIVER' ? bk.driverId === g.c.sub : bk.mechanicId === g.c.sub
      if (!mine) return err(403, 'FORBIDDEN', 'Not your booking')
      const to = b.status!
      if (!NEXT[bk.status].includes(to)) return err(409, 'STATE_CONFLICT', `Cannot go from ${bk.status} to ${to}`)
      if (g.c.role === 'DRIVER' && to !== 'CANCELLED') return err(403, 'FORBIDDEN', 'Drivers can only cancel')
      if (g.c.role === 'MECHANIC' && to === 'CANCELLED') return err(403, 'FORBIDDEN', 'Reject the booking instead')
      if (to === 'CANCELLED') {
        const start = new Date(`${bk.date}T${bk.startTime}:00`).getTime()
        if (start - Date.now() < 2 * 3600000) return err(422, 'TOO_LATE', 'Too late to cancel (less than 2 hours before)')
      }
      bk.status = to
      const target = g.c.role === 'DRIVER' ? bk.mechanicId : bk.driverId
      notify(d, target, `BOOKING_${to}`, `Booking ${to.toLowerCase().replace('_', ' ')}`, `Booking on ${bk.date} at ${bk.startTime}.`)
      return json(bookingOut(d, bk))
    })
  }),

  http.post(`${base}/bookings/:id/review`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['DRIVER'])
    if (!g.ok) return g.res
    const b = await body<{ rating: number; comment?: string }>(request)
    if (!b.rating || b.rating < 1 || b.rating > 5) return err(400, 'VALIDATION_ERROR', 'Rating 1 to 5', 'rating')
    return mutate((d) => {
      const bk = d.bookings.find((x) => x.id === params.id && x.driverId === g.c.sub)
      if (!bk) return err(404, 'NOT_FOUND', 'Booking not found')
      if (bk.status !== 'DONE') return err(422, 'BUSINESS_RULE', 'You can review only after the service')
      if (bk.reviewed) return err(409, 'ALREADY_REVIEWED', 'You already reviewed this booking')
      bk.reviewed = true
      const r = { id: uid(), bookingId: bk.id, mechanicId: bk.mechanicId, rating: b.rating!, comment: b.comment, authorName: userName(d, g.c.sub), createdAt: now() }
      d.reviews.unshift(r)
      return json({ id: r.id, rating: r.rating }, 201)
    })
  }),
]
