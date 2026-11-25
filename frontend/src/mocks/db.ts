/**
 * In-browser mock database for S1-S6, seeded from contract/seed (repo root)/*.json.
 * Saved in localStorage so two tabs (driver + supplier) see the same data during a demo.
 */
import s1Seed from './seed/s1-identity.json'
import s2Seed from './seed/s2-parts.json'
import s3Seed from './seed/s3-mechanic.json'
import s4Seed from './seed/s4-towing.json'
import s5Seed from './seed/s5-payment.json'
import s6Seed from './seed/s6-notification.json'

export type Role = 'DRIVER' | 'SUPPLIER' | 'MECHANIC' | 'TOW_DRIVER' | 'DISPATCHER' | 'ADMIN'

export interface MUser {
  id: string
  fullName: string
  phone: string
  role: Role
  language: 'ar' | 'fr' | 'en'
  status: 'PENDING_OTP' | 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED'
  approved: boolean
  createdAt: string
  password: string
  failed: number
  lockedUntil?: number
}
export interface MApplication {
  id: string
  userId: string
  role: string
  businessName?: string
  wilaya?: string
  documentNumber?: string
  vehiclePlate?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reason?: string
  createdAt: string
}
export interface MPart {
  id: string
  name: string
  brand: string
  category: string
  reference?: string
  compatibleVehicles?: string[]
  imageUrl?: string
}
export interface MOffer {
  id: string
  partId: string
  supplierId: string
  price: number
  stock: number
  condition: 'NEW' | 'USED'
  warrantyMonths?: number
  deliveryWilayas?: string[]
  active: boolean
}
export interface MOrderItem {
  offerId: string
  supplierId: string
  qty: number
  unitPrice: number
  partName?: string
  supplierName?: string
}
export interface MOrder {
  id: string
  driverId: string
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  paymentMethod: 'CASH' | 'SANDBOX'
  deliveryAddress: string
  wilaya: string
  deliveryFee: number
  total: number
  items: MOrderItem[]
  createdAt: string
  cancelReason?: string
  payUrl?: string
  reviewed?: boolean
}
export interface MReview {
  id: string
  orderId?: string
  bookingId?: string
  supplierId?: string
  mechanicId?: string
  rating: number
  comment?: string
  authorName?: string
  createdAt: string
}
export interface MMechanic {
  userId: string
  garageName: string
  wilaya: string
  address?: string
  lat?: number
  lng?: number
  specialties?: string[]
  offersMobile: boolean
  workingHours?: Record<string, string>
  rating?: number
  bio?: string
}
export interface MService {
  id: string
  mechanicId: string
  name: string
  price: number
  durationMin: number
  active: boolean
}
export interface MBooking {
  id: string
  driverId: string
  mechanicId: string
  serviceId: string
  price: number
  date: string
  startTime: string
  place: 'GARAGE' | 'AT_CLIENT'
  clientAddress?: string
  vehicle?: string
  note?: string
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'DONE' | 'REJECTED' | 'CANCELLED'
  createdAt: string
  reviewed?: boolean
}
export interface MTowDriver {
  userId: string
  plate: string
  truckType: string
  available: boolean
  lat: number
  lng: number
  positionAt?: string
  lastPoll?: number
}
export interface MTow {
  id: string
  driverId?: string
  guestPhone?: string
  trackingCode: string
  pickupLat: number
  pickupLng: number
  pickupAddress?: string
  destinationAddress?: string
  vehicle?: string
  issue?: string
  urgency: 'NORMAL' | 'URGENT'
  status: 'SEARCHING' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED' | 'NO_DRIVER'
  estimatedPrice?: number
  assignedTowDriverId?: string
  etaMinutes?: number
  createdAt: string
  assignedAt?: number
  arrivedAt?: number
  startLat?: number
  startLng?: number
  /** No real tow-driver tab is driving this job: the mock moves the truck itself. */
  simulated?: boolean
  trail: { lat: number; lng: number; at: string }[]
  triedDrivers: string[]
}
export interface MTowOffer {
  id: string
  requestId: string
  towDriverId: string
  sentAt: number
  expiresAt: number
  status: 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
}
export interface MPayment {
  id: string
  refType: 'ORDER' | 'TOW'
  refId: string
  payerId: string
  amount: number
  method: 'CASH' | 'SANDBOX'
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  createdAt: string
  paidAt?: string
  token?: string
  label?: string
  expiresAt?: string
}
export interface MNotification {
  id: string
  userId: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: string
}
export interface MSms {
  id: string
  phone: string
  text: string
  status: 'SENT'
  createdAt: string
}

export interface DB {
  version: number
  users: MUser[]
  applications: MApplication[]
  otps: { phone: string; code: string; purpose: 'SIGNUP' | 'RESET'; expiresAt: number; attempts: number; sentAt: number }[]
  parts: MPart[]
  offers: MOffer[]
  deliveryFees: { wilaya: string; fee: number }[]
  orders: MOrder[]
  reviews: MReview[]
  mechanics: MMechanic[]
  services: MService[]
  bookings: MBooking[]
  towDrivers: MTowDriver[]
  tows: MTow[]
  towOffers: MTowOffer[]
  towConfig: { offerTimeoutSeconds: number; maxOffers: number; baseFee: number; perKm: number; hotline: string }
  payments: MPayment[]
  notifications: MNotification[]
  sms: MSms[]
}

const KEY = 'df.mockdb'
const VERSION = 4

export const uid = () => crypto.randomUUID()
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString()

function seed(): DB {
  const users: MUser[] = s1Seed.users.map((u, i) => ({
    ...(u as Omit<MUser, 'password' | 'failed' | 'createdAt'>),
    createdAt: daysAgo(60 - i * 4),
    password: s1Seed.password_for_all,
    failed: 0,
  }))
  const applications: MApplication[] = [
    ...s1Seed.applications.map((a) => ({ ...(a as MApplication), createdAt: daysAgo(2) })),
  ]
  // Extra demo data so admin, supplier and mechanic screens are not empty
  const extraParts: MPart[] = [
    { id: uid(), name: 'Alternator 90A', brand: 'Valeo', category: 'Electrical', reference: 'TG9S012', compatibleVehicles: ['Clio 4', 'Symbol'] },
    { id: uid(), name: 'Rear shock absorbers (pair)', brand: 'Monroe', category: 'Suspension', reference: 'G1145', compatibleVehicles: ['Golf 7', 'Leon 3'] },
  ]
  const offers: MOffer[] = [...(s2Seed.offers as MOffer[])]
  offers.push(
    { id: uid(), partId: extraParts[0].id, supplierId: users[4].id, price: 9500, stock: 2, condition: 'USED', warrantyMonths: 3, deliveryWilayas: ['31', '16'], active: true },
    { id: uid(), partId: extraParts[1].id, supplierId: users[3].id, price: 14800, stock: 6, condition: 'NEW', warrantyMonths: 24, deliveryWilayas: ['16', '09', '35'], active: true },
  )
  const orders: MOrder[] = (s2Seed.orders as Omit<MOrder, 'createdAt'>[]).map((o) => ({ ...o, createdAt: daysAgo(1) }))
  const tows: MTow[] = (s4Seed.tow_requests as Omit<MTow, 'createdAt' | 'trail' | 'triedDrivers'>[]).map((t) => ({
    ...t,
    createdAt: new Date(Date.now() - 4 * 60000).toISOString(),
    estimatedPrice: 4200,
    trail: [],
    triedDrivers: [],
  }))
  // Every tow has a cash payment (the real S4 creates one on POST /tows), so seeded jobs can be settled too.
  const towPayments: MPayment[] = tows.map((t) => ({ id: uid(), refType: 'TOW', refId: t.id, payerId: t.driverId ?? '', amount: t.estimatedPrice ?? 4200, method: 'CASH', status: 'PENDING', createdAt: t.createdAt }))

  return {
    version: VERSION,
    users,
    applications,
    otps: [],
    parts: [...(s2Seed.parts as MPart[]), ...extraParts],
    offers,
    deliveryFees: s2Seed.delivery_fees,
    orders,
    reviews: [
      { id: uid(), supplierId: users[3].id, orderId: orders[0]?.id, rating: 5, comment: 'Fast delivery, correct part.', authorName: 'Karim B.', createdAt: daysAgo(12) },
      { id: uid(), mechanicId: users[5].id, rating: 5, comment: 'Clear price, done on time.', authorName: 'Sara A.', createdAt: daysAgo(9) },
      { id: uid(), mechanicId: users[5].id, rating: 4, comment: 'Good work, a bit of waiting.', authorName: 'Karim B.', createdAt: daysAgo(20) },
    ],
    mechanics: s3Seed.mechanic_profiles as unknown as MMechanic[],
    services: s3Seed.services as MService[],
    bookings: (s3Seed.bookings as Omit<MBooking, 'createdAt'>[]).map((b) => ({ ...b, createdAt: daysAgo(1) })),
    towDrivers: s4Seed.tow_drivers as MTowDriver[],
    tows,
    towOffers: [],
    towConfig: s4Seed.config,
    payments: [...(s5Seed.payments as Omit<MPayment, 'createdAt'>[]).map((p) => ({ ...p, createdAt: daysAgo(1) })), ...towPayments],
    notifications: (s6Seed.notifications as Omit<MNotification, 'createdAt'>[]).map((n) => ({ ...n, createdAt: daysAgo(1) })),
    sms: [],
  }
}

let cache: DB | null = null

export function db(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      if (parsed.version === VERSION) {
        cache = parsed
        return parsed
      }
    }
  } catch {
    /* fall through */
  }
  if (!cache) {
    cache = seed()
    save(cache)
  }
  return cache
}

export function save(d: DB) {
  cache = d
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* quota or private mode: memory only */
  }
}

/** Run a mutation on the db and persist it. */
export function mutate<T>(fn: (d: DB) => T): T {
  const d = db()
  const out = fn(d)
  save(d)
  return out
}

export function resetMockDb() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  cache = null
}

export function userName(d: DB, id: string | undefined): string | undefined {
  return d.users.find((u) => u.id === id)?.fullName
}

export function notify(d: DB, userId: string | undefined, type: string, title: string, body: string) {
  if (!userId) return
  d.notifications.unshift({ id: uid(), userId, type, title, body, read: false, createdAt: new Date().toISOString() })
}

export function sms(d: DB, phone: string, text: string) {
  d.sms.unshift({ id: uid(), phone, text, status: 'SENT', createdAt: new Date().toISOString() })
  console.info(`[SMS MOCK] to=${phone} ${text}`)
}

/** Straight-line distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
