import { http } from './http'
import type { Booking, BookingStatus, MechanicProfile, MechanicReview, MechanicService, Paged } from './models'

type PageQ = { page?: number; pageSize?: number }

/** S3 Mechanic: profiles, services, slots, bookings. */
export const s3 = {
  mechanics: (q: { wilaya?: string; specialty?: string; atClient?: boolean; minRating?: number } & PageQ) =>
    http.list<Paged<MechanicProfile>>('s3', '/mechanics', { query: q, auth: false }),
  mechanic: (id: string) =>
    http.get<{ profile: MechanicProfile; services: MechanicService[]; reviews: MechanicReview[] }>(
      's3',
      `/mechanics/${id}`,
      { auth: false },
    ),
  /** v1.1: serviceId makes the slot length match the service duration. */
  slots: (id: string, date: string, serviceId?: string) =>
    http.get<{ date: string; slots: string[] }>('s3', `/mechanics/${id}/slots`, { query: { date, serviceId }, auth: false }),
  saveProfile: (body: Omit<MechanicProfile, 'userId' | 'rating' | 'reviewsCount' | 'offersMobile'> & { offersMobile?: boolean }) =>
    http.put<MechanicProfile>('s3', '/mechanics/me', body),
  myServices: () => http.list<{ items: MechanicService[] }>('s3', '/mechanics/me/services'),
  createService: (body: { name: string; price: number; durationMin: number }) =>
    http.post<MechanicService>('s3', '/mechanics/me/services', body),
  updateService: (id: string, body: Partial<{ name: string; price: number; durationMin: number; active: boolean }>) =>
    http.patch<MechanicService>('s3', `/mechanics/me/services/${id}`, body),
  deleteService: (id: string) => http.del<void>('s3', `/mechanics/me/services/${id}`),
  book: (body: {
    mechanicId: string
    serviceId: string
    date: string
    startTime: string
    place: 'GARAGE' | 'AT_CLIENT'
    clientAddress?: string
    vehicle?: string
    note?: string
  }) => http.post<Booking>('s3', '/bookings', body),
  bookings: (q: { status?: string } & PageQ) => http.list<Paged<Booking>>('s3', '/bookings', { query: q }),
  setBookingStatus: (id: string, status: Exclude<BookingStatus, 'PENDING'>, reason?: string) =>
    http.patch<Booking>('s3', `/bookings/${id}/status`, { status, reason }),
  reviewBooking: (id: string, rating: number, comment?: string) =>
    http.post<{ id: string; rating: number }>('s3', `/bookings/${id}/review`, { rating, comment }),
}
