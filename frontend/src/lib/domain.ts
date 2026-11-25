import type { Tone } from '@/design/ui/Badge'
import type { BookingStatus, OrderStatus, TowStatus } from '@/api/models'

export const CATEGORIES = ['Brakes', 'Filters', 'Ignition', 'Engine', 'Electrical', 'Suspension'] as const
export const SPECIALTIES = ['Brakes', 'Engine', 'Electrical', 'AC', 'Suspension', 'Bodywork'] as const

export const TOW_TONE: Record<TowStatus, Tone> = {
  SEARCHING: 'warning',
  ASSIGNED: 'info',
  EN_ROUTE: 'info',
  ARRIVED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  NO_DRIVER: 'danger',
}

export const ORDER_TONE: Record<OrderStatus, Tone> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
}

export const BOOKING_TONE: Record<BookingStatus, Tone> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  IN_PROGRESS: 'orange',
  DONE: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
}
