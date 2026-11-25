import type { components as C1 } from './types/s1'
import type { components as C2 } from './types/s2'
import type { components as C3 } from './types/s3'
import type { components as C4 } from './types/s4'
import type { components as C5 } from './types/s5'
import type { components as C6 } from './types/s6'

export type User = C1['schemas']['User']
/** S1 adds fullName and phone to each application (additive). */
export type Application = C1['schemas']['Application'] & { fullName?: string; phone?: string }
export type Language = User['language']
export type UserStatus = User['status']

export type Part = C2['schemas']['Part']
export type Offer = C2['schemas']['Offer']
export type OrderLine = C2['schemas']['OrderItem'] & {
  partName?: string
  supplierName?: string
}
export type Order = Omit<C2['schemas']['Order'], 'items'> & {
  items: OrderLine[]
  cancelReason?: string
}
export type OrderStatus = Order['status']
export type Review = C2['schemas']['Review']

/** Offer as returned inside GET /parts/{id}, enriched with supplier info when available. */
export type OfferWithSupplier = Offer & {
  supplierName?: string
  supplierRating?: number
  supplierWilaya?: string
}

export type MechanicProfile = Omit<C3['schemas']['MechanicProfile'], 'workingHours'> & {
  workingHours?: Record<string, string>
  reviewsCount?: number
}
export type MechanicService = C3['schemas']['Service']
export type Booking = C3['schemas']['Booking'] & {
  serviceName?: string
  garageName?: string
  driverName?: string
  driverPhone?: string
}
export type BookingStatus = Booking['status']
export interface MechanicReview {
  id: string
  bookingId?: string
  rating: number
  comment?: string
  authorName?: string
  createdAt: string
}

export type TowRequest = C4['schemas']['TowRequest']
export type TowStatus = TowRequest['status']
export type TowOffer = C4['schemas']['TowOffer']
export type Position = C4['schemas']['Position']
export interface TowDriverInfo {
  userId: string
  fullName?: string
  phone?: string
  plate?: string
  truckType?: string
  available?: boolean
  lat?: number
  lng?: number
}

export type Payment = C5['schemas']['Payment']
export type Notification = C6['schemas']['Notification']

export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface ApiErrorBody {
  error: { code: string; message: string; field?: string }
}
