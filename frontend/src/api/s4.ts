import { http } from './http'
import type { Paged, Position, TowDriverInfo, TowOffer, TowRequest, TowStatus } from './models'

type PageQ = { page?: number; pageSize?: number }

export interface TowDetail {
  request: TowRequest
  towDriver?: TowDriverInfo
  lastPosition?: Position
}

/** S4 Towing: SOS, offers, tracking, dispatch. */
export const s4 = {
  create: (body: {
    pickupLat: number
    pickupLng: number
    pickupAddress?: string
    destinationAddress?: string
    vehicle?: string
    issue?: string
    urgency: 'NORMAL' | 'URGENT'
    guestPhone?: string
  }) => http.post<TowRequest>('s4', '/tows', body),
  get: (id: string, trackingCode?: string) => http.get<TowDetail>('s4', `/tows/${id}`, { query: { trackingCode } }),
  cancel: (id: string) => http.post<TowRequest>('s4', `/tows/${id}/cancel`),
  setAvailability: (available: boolean) =>
    http.put<{ available: boolean }>('s4', '/tow-drivers/me/availability', { available }),
  sendPosition: (lat: number, lng: number) => http.put<void>('s4', '/tow-drivers/me/position', { lat, lng }),
  myOffer: () => http.get<TowOffer>('s4', '/tow-drivers/me/offer'),
  accept: (offerId: string) => http.post<TowRequest>('s4', `/tow-offers/${offerId}/accept`),
  decline: (offerId: string) => http.post<void>('s4', `/tow-offers/${offerId}/decline`),
  setStatus: (id: string, status: Extract<TowStatus, 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED'>) =>
    http.patch<TowRequest>('s4', `/tows/${id}/status`, { status }),
  track: (id: string, trackingCode?: string) =>
    http.get<{ last: Position; trail: Position[]; etaMinutes?: number }>('s4', `/tows/${id}/track`, {
      query: { trackingCode },
    }),
  board: (q: { status?: string } & PageQ) => http.list<Paged<TowRequest>>('s4', '/dispatch/tows', { query: q }),
  /** v1.1, optional in the contract: trucks for the dispatcher board. Without it (404) the UI shows the seed drivers. */
  fleet: () =>
    http.list<{ items: (TowDriverInfo & { busy?: boolean; positionAt?: string })[] }>('s4', '/dispatch/tow-drivers'),
  assign: (id: string, towDriverId: string) =>
    http.post<TowRequest>('s4', `/dispatch/tows/${id}/assign`, { towDriverId }),
}
