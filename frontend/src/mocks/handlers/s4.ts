import { http } from 'msw'
import { serviceUrl } from '@/lib/env'
import { db, distanceKm, mutate, notify, uid, userName, type DB, type MTow } from '../db'
import { createPayment } from './s5'
import { body, caller, err, json, latency, noContent, now, paged, requireRole, serviceKeyError } from './common'

const base = serviceUrl('s4')

const ACTIVE: MTow['status'][] = ['ASSIGNED', 'EN_ROUTE', 'ARRIVED']
/** Simulated drive time from acceptance to arrival. */
const DRIVE_MS = 75_000
/** A tow-driver tab that polled in the last 15 s is "live": no auto-accept for it. */
const LIVE_MS = 15_000
const AUTO_ACCEPT_MS = 7_000

function isLive(d: DB, driverId: string) {
  const t = d.towDrivers.find((x) => x.userId === driverId)
  return Boolean(t?.lastPoll && Date.now() - t.lastPoll < LIVE_MS)
}

function busy(d: DB, driverId: string) {
  return (
    d.tows.some((t) => t.assignedTowDriverId === driverId && ACTIVE.includes(t.status)) ||
    d.towOffers.some((o) => o.towDriverId === driverId && o.status === 'OFFERED')
  )
}

function assign(d: DB, tow: MTow, driverId: string, simulated: boolean) {
  const driver = d.towDrivers.find((x) => x.userId === driverId)
  tow.status = 'ASSIGNED'
  tow.assignedTowDriverId = driverId
  tow.assignedAt = Date.now()
  tow.simulated = simulated
  tow.startLat = driver?.lat ?? tow.pickupLat + 0.03
  tow.startLng = driver?.lng ?? tow.pickupLng - 0.04
  const km = distanceKm(tow.startLat, tow.startLng, tow.pickupLat, tow.pickupLng)
  tow.etaMinutes = Math.max(3, Math.round((km / 35) * 60))
  notify(d, tow.driverId, 'TOW_ASSIGNED', 'Tow driver assigned', `A tow driver is on the way. ETA ${tow.etaMinutes} min.`)
}

/** Advances dispatch and simulated trucks. Called on every S4 request (no timers in a mock). */
function tick(d: DB) {
  const { offerTimeoutSeconds, maxOffers } = d.towConfig
  for (const tow of d.tows) {
    if (tow.status === 'SEARCHING') {
      const open = d.towOffers.find((o) => o.requestId === tow.id && o.status === 'OFFERED')
      if (open) {
        if (open.expiresAt < Date.now()) open.status = 'EXPIRED'
        else if (!isLive(d, open.towDriverId) && Date.now() - open.sentAt > AUTO_ACCEPT_MS) {
          open.status = 'ACCEPTED'
          assign(d, tow, open.towDriverId, true)
          continue
        } else continue
      }
      if (tow.triedDrivers.length >= maxOffers) {
        tow.status = 'NO_DRIVER'
        notify(d, tow.driverId, 'TOW_NO_DRIVER', 'No driver yet', 'A dispatcher is looking for a truck for you.')
        continue
      }
      const next = d.towDrivers
        .filter((t) => t.available && !tow.triedDrivers.includes(t.userId) && !busy(d, t.userId))
        .sort((a, b) => distanceKm(a.lat, a.lng, tow.pickupLat, tow.pickupLng) - distanceKm(b.lat, b.lng, tow.pickupLat, tow.pickupLng))[0]
      if (!next) {
        if (tow.triedDrivers.length > 0 || !d.towDrivers.some((t) => t.available)) tow.status = 'NO_DRIVER'
        continue
      }
      tow.triedDrivers.push(next.userId)
      d.towOffers.push({
        id: uid(),
        requestId: tow.id,
        towDriverId: next.userId,
        sentAt: Date.now(),
        expiresAt: Date.now() + offerTimeoutSeconds * 1000,
        status: 'OFFERED',
      })
    } else if (ACTIVE.includes(tow.status) && tow.simulated && tow.assignedAt) {
      const elapsed = Date.now() - tow.assignedAt
      if (tow.status === 'ASSIGNED' && elapsed > 3000) tow.status = 'EN_ROUTE'
      if (tow.status === 'EN_ROUTE' && elapsed >= DRIVE_MS) {
        tow.status = 'ARRIVED'
        tow.arrivedAt = Date.now()
        notify(d, tow.driverId, 'TOW_ARRIVED', 'Tow truck arrived', 'Your tow truck is at the pickup point.')
      }
      if (tow.status === 'ARRIVED' && tow.arrivedAt && Date.now() - tow.arrivedAt > 30_000) {
        tow.status = 'COMPLETED'
        notify(d, tow.driverId, 'TOW_COMPLETED', 'Tow completed', 'Your car has been towed. Thank you for using DriveFix.')
      }
    }
  }
}

function simulatedPosition(tow: MTow) {
  const p = Math.min(1, (Date.now() - (tow.assignedAt ?? Date.now())) / DRIVE_MS)
  const ease = 1 - Math.pow(1 - p, 2)
  // Slight curve so the path does not look like a ruler line
  const lat = (tow.startLat ?? tow.pickupLat) + (tow.pickupLat - (tow.startLat ?? tow.pickupLat)) * ease + Math.sin(ease * Math.PI) * 0.004
  const lng = (tow.startLng ?? tow.pickupLng) + (tow.pickupLng - (tow.startLng ?? tow.pickupLng)) * ease
  return { lat, lng, at: now(), progress: p }
}

function position(d: DB, tow: MTow) {
  const driver = d.towDrivers.find((x) => x.userId === tow.assignedTowDriverId)
  if (!driver) return undefined
  if (tow.simulated && ['ASSIGNED', 'EN_ROUTE'].includes(tow.status)) return simulatedPosition(tow)
  if (tow.status === 'ARRIVED' || tow.status === 'COMPLETED') return { lat: tow.pickupLat, lng: tow.pickupLng, at: now() }
  return { lat: driver.lat, lng: driver.lng, at: driver.positionAt ?? now() }
}

function canSee(request: Request, tow: MTow) {
  const code = new URL(request.url).searchParams.get('trackingCode')
  if (code && code === tow.trackingCode) return true
  const c = caller(request)
  if (!c) return false
  return c.role === 'DISPATCHER' || c.role === 'ADMIN' || tow.driverId === c.sub || tow.assignedTowDriverId === c.sub
}

function towOut(tow: MTow) {
  const { trail: _t, triedDrivers: _d, assignedAt: _a, arrivedAt: _r, startLat: _s1, startLng: _s2, simulated: _s, ...rest } = tow
  return rest
}

function detail(d: DB, tow: MTow) {
  const driver = d.towDrivers.find((x) => x.userId === tow.assignedTowDriverId)
  const user = d.users.find((u) => u.id === tow.assignedTowDriverId)
  const pos = position(d, tow)
  let eta = tow.etaMinutes
  if (pos && tow.status === 'EN_ROUTE') eta = Math.max(1, Math.round((distanceKm(pos.lat, pos.lng, tow.pickupLat, tow.pickupLng) / 35) * 60))
  if (tow.status === 'ARRIVED') eta = 0
  return {
    request: { ...towOut(tow), etaMinutes: eta },
    towDriver: driver
      ? { userId: driver.userId, fullName: user?.fullName, phone: user?.phone, plate: driver.plate, truckType: driver.truckType }
      : undefined,
    lastPosition: pos ? { lat: pos.lat, lng: pos.lng, at: pos.at } : undefined,
  }
}

export const s4Handlers = [
  http.post(`${base}/tows`, async ({ request }) => {
    await latency()
    const c = caller(request)
    const b = await body<MTow & { guestPhone?: string }>(request)
    if (typeof b.pickupLat !== 'number' || typeof b.pickupLng !== 'number') return err(400, 'VALIDATION_ERROR', 'Pickup position is required', 'pickupLat')
    if (!c && !/^0[5-7]\d{8}$/.test(b.guestPhone ?? '')) return err(400, 'VALIDATION_ERROR', 'A valid phone number is required', 'guestPhone')
    if (c && c.role !== 'DRIVER') return err(403, 'FORBIDDEN', 'Only drivers can request a tow')
    return mutate((d) => {
      const open = c && d.tows.find((t) => t.driverId === c.sub && ['SEARCHING', ...ACTIVE].includes(t.status))
      if (open) return err(422, 'BUSINESS_RULE', 'You already have an active tow request')
      const code = `SOS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      const nearest = Math.min(...d.towDrivers.map((t) => distanceKm(t.lat, t.lng, b.pickupLat!, b.pickupLng!)), 15)
      const tow: MTow = {
        id: uid(),
        driverId: c?.sub,
        guestPhone: c ? undefined : b.guestPhone,
        trackingCode: code,
        pickupLat: b.pickupLat!,
        pickupLng: b.pickupLng!,
        pickupAddress: b.pickupAddress,
        destinationAddress: b.destinationAddress,
        vehicle: b.vehicle,
        issue: b.issue,
        urgency: b.urgency ?? 'NORMAL',
        status: 'SEARCHING',
        estimatedPrice: Math.round((d.towConfig.baseFee + d.towConfig.perKm * (nearest + 8)) / 100) * 100,
        createdAt: now(),
        trail: [],
        triedDrivers: [],
      }
      d.tows.unshift(tow)
      createPayment(d, { refType: 'TOW', refId: tow.id, payerId: c?.sub ?? tow.id, amount: tow.estimatedPrice!, method: 'CASH', label: `Tow ${code}` })
      tick(d)
      return json(towOut(tow), 201)
    })
  }),

  http.get(`${base}/tows/:id/track`, async ({ request, params }) => {
    await latency()
    return mutate((d) => {
      tick(d)
      const tow = d.tows.find((t) => t.id === params.id)
      if (!tow) return err(404, 'NOT_FOUND', 'Tow request not found')
      if (!canSee(request, tow)) return err(403, 'FORBIDDEN', 'You cannot follow this request')
      const det = detail(d, tow)
      const last = det.lastPosition ?? { lat: tow.pickupLat, lng: tow.pickupLng, at: now() }
      if (det.lastPosition) {
        const prev = tow.trail[tow.trail.length - 1]
        if (!prev || prev.lat !== last.lat || prev.lng !== last.lng) tow.trail = [...tow.trail, last].slice(-30)
      }
      return json({ last, trail: tow.trail, etaMinutes: det.request.etaMinutes })
    })
  }),

  http.get(`${base}/tows/:id`, async ({ request, params }) => {
    await latency()
    return mutate((d) => {
      tick(d)
      const tow = d.tows.find((t) => t.id === params.id || t.trackingCode === params.id)
      if (!tow) return err(404, 'NOT_FOUND', 'Tow request not found')
      if (!canSee(request, tow)) return err(403, 'FORBIDDEN', 'You cannot follow this request')
      return json(detail(d, tow))
    })
  }),

  http.post(`${base}/tows/:id/cancel`, async ({ request, params }) => {
    await latency()
    return mutate((d) => {
      const tow = d.tows.find((t) => t.id === params.id)
      const code = new URL(request.url).searchParams.get('trackingCode')
      if (!caller(request) && !code) return err(401, 'UNAUTHORIZED', 'Authentication required')
      if (!tow) return err(404, 'NOT_FOUND', 'Tow request not found')
      if (!canSee(request, tow)) return err(403, 'FORBIDDEN', 'Not your request')
      if (!['SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'NO_DRIVER'].includes(tow.status)) return err(409, 'STATE_CONFLICT', 'Too late to cancel')
      tow.status = 'CANCELLED'
      d.towOffers.filter((o) => o.requestId === tow.id && o.status === 'OFFERED').forEach((o) => (o.status = 'EXPIRED'))
      return json(towOut(tow))
    })
  }),

  http.put(`${base}/tow-drivers/me/availability`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['TOW_DRIVER'], true)
    if (!g.ok) return g.res
    const b = await body<{ available: boolean }>(request)
    return mutate((d) => {
      let t = d.towDrivers.find((x) => x.userId === g.c.sub)
      if (!t) {
        t = { userId: g.c.sub, plate: '—', truckType: 'Flatbed', available: false, lat: 36.75, lng: 3.06 }
        d.towDrivers.push(t)
      }
      if (!b.available && d.tows.some((x) => x.assignedTowDriverId === g.c.sub && ACTIVE.includes(x.status)))
        return err(409, 'STATE_CONFLICT', 'Finish the current job before going offline')
      t.available = Boolean(b.available)
      t.lastPoll = Date.now()
      return json({ available: t.available })
    })
  }),

  http.put(`${base}/tow-drivers/me/position`, async ({ request }) => {
    const g = requireRole(request, ['TOW_DRIVER'])
    if (!g.ok) return g.res
    const b = await body<{ lat: number; lng: number }>(request)
    if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return err(400, 'VALIDATION_ERROR', 'lat and lng are required')
    mutate((d) => {
      const t = d.towDrivers.find((x) => x.userId === g.c.sub)
      if (t) Object.assign(t, { lat: b.lat, lng: b.lng, positionAt: now(), lastPoll: Date.now() })
      const job = d.tows.find((x) => x.assignedTowDriverId === g.c.sub && ACTIVE.includes(x.status))
      if (job) job.simulated = false
    })
    return noContent()
  }),

  http.get(`${base}/tow-drivers/me/offer`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['TOW_DRIVER'])
    if (!g.ok) return g.res
    return mutate((d) => {
      const t = d.towDrivers.find((x) => x.userId === g.c.sub)
      if (t) t.lastPoll = Date.now()
      tick(d)
      const o = d.towOffers.find((x) => x.towDriverId === g.c.sub && x.status === 'OFFERED' && x.expiresAt > Date.now())
      if (!o) return err(404, 'NOT_FOUND', 'No open offer')
      const tow = d.tows.find((x) => x.id === o.requestId)!
      return json({
        id: o.id,
        requestId: o.requestId,
        pickupAddress: tow.pickupAddress,
        distanceKm: t ? Math.round(distanceKm(t.lat, t.lng, tow.pickupLat, tow.pickupLng) * 10) / 10 : undefined,
        estimatedPrice: tow.estimatedPrice,
        secondsLeft: Math.max(0, Math.round((o.expiresAt - Date.now()) / 1000)),
        status: o.status,
        vehicle: tow.vehicle,
        issue: tow.issue,
        urgency: tow.urgency,
      })
    })
  }),

  http.post(`${base}/tow-offers/:id/:action`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['TOW_DRIVER'])
    if (!g.ok) return g.res
    return mutate((d) => {
      const o = d.towOffers.find((x) => x.id === params.id && x.towDriverId === g.c.sub)
      if (!o) return err(404, 'NOT_FOUND', 'Offer not found')
      if (o.status !== 'OFFERED' || o.expiresAt < Date.now()) {
        if (o.status === 'OFFERED') o.status = 'EXPIRED'
        return err(409, 'OFFER_EXPIRED', 'This offer has expired')
      }
      const tow = d.tows.find((x) => x.id === o.requestId)!
      if (params.action === 'decline') {
        o.status = 'DECLINED'
        tick(d)
        return noContent()
      }
      if (tow.status !== 'SEARCHING') return err(409, 'OFFER_EXPIRED', 'Another driver took this request')
      o.status = 'ACCEPTED'
      assign(d, tow, g.c.sub, false)
      return json(towOut(tow))
    })
  }),

  http.patch(`${base}/tows/:id/status`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['TOW_DRIVER'])
    if (!g.ok) return g.res
    const b = await body<{ status: 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED' }>(request)
    const NEXT: Record<string, string> = { ASSIGNED: 'EN_ROUTE', EN_ROUTE: 'ARRIVED', ARRIVED: 'COMPLETED' }
    return mutate((d) => {
      const tow = d.tows.find((x) => x.id === params.id)
      if (!tow) return err(404, 'NOT_FOUND', 'Tow request not found')
      if (tow.assignedTowDriverId !== g.c.sub) return err(403, 'FORBIDDEN', 'Not your job')
      if (NEXT[tow.status] !== b.status) return err(409, 'STATE_CONFLICT', `Cannot go from ${tow.status} to ${b.status}`)
      tow.status = b.status!
      tow.simulated = false
      if (b.status === 'ARRIVED') notify(d, tow.driverId, 'TOW_ARRIVED', 'Tow truck arrived', 'Your tow truck is at the pickup point.')
      if (b.status === 'COMPLETED') notify(d, tow.driverId, 'TOW_COMPLETED', 'Tow completed', 'Thank you for using DriveFix.')
      return json(towOut(tow))
    })
  }),

  http.get(`${base}/dispatch/tows`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['DISPATCHER', 'ADMIN'])
    if (!g.ok) return g.res
    const status = new URL(request.url).searchParams.get('status')
    return mutate((d) => {
      tick(d)
      const items = d.tows
        .filter((t) => !status || status.split(',').includes(t.status))
        .map((t) => ({
          ...towOut(t),
          assignedTowDriverName: userName(d, t.assignedTowDriverId),
          offersSent: t.triedDrivers.length,
        }))
      return paged(items, request)
    })
  }),

  http.post(`${base}/dispatch/tows/:id/assign`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['DISPATCHER'])
    if (!g.ok) return g.res
    const b = await body<{ towDriverId: string }>(request)
    return mutate((d) => {
      const tow = d.tows.find((x) => x.id === params.id)
      if (!tow) return err(404, 'NOT_FOUND', 'Tow request not found')
      if (!['SEARCHING', 'NO_DRIVER'].includes(tow.status)) return err(409, 'STATE_CONFLICT', 'This request already has a driver')
      if (!d.towDrivers.some((t) => t.userId === b.towDriverId)) return err(404, 'NOT_FOUND', 'Tow driver not found', 'towDriverId')
      if (busy(d, b.towDriverId!)) return err(409, 'STATE_CONFLICT', 'This driver is busy', 'towDriverId')
      d.towOffers.filter((o) => o.requestId === tow.id && o.status === 'OFFERED').forEach((o) => (o.status = 'EXPIRED'))
      assign(d, tow, b.towDriverId!, !isLive(d, b.towDriverId!))
      return json(towOut(tow))
    })
  }),

  /** Mock-only helper so the dispatcher board can list trucks (no such endpoint in the contract). */
  http.get(`${base}/dispatch/tow-drivers`, async ({ request }) => {
    const g = requireRole(request, ['DISPATCHER', 'ADMIN'])
    if (!g.ok) return g.res
    const d = db()
    return json({
      items: d.towDrivers.map((t) => ({ ...t, fullName: userName(d, t.userId), busy: busy(d, t.userId) })),
    })
  }),
  /** Service-to-service: S5 reports the result of an online tow payment. */
  http.post(`${base}/internal/payments/:towId/result`, ({ request, params }) => {
    const denied = serviceKeyError(request)
    if (denied) return denied
    if (!db().tows.some((x) => x.id === params.towId)) return err(404, 'NOT_FOUND', 'Tow request not found')
    return noContent()
  }),
]
