import { http } from './http'
import type { Offer, OfferWithSupplier, Order, OrderStatus, Paged, Part, Review } from './models'

type PageQ = { page?: number; pageSize?: number }

/** S2 Parts: catalogue, offers, orders, reviews. */
export const s2 = {
  parts: (q: { q?: string; brand?: string; category?: string; vehicle?: string } & PageQ) =>
    http.list<Paged<Part>>('s2', '/parts', { query: q, auth: false }),
  part: (id: string) => http.get<{ part: Part; offers: OfferWithSupplier[] }>('s2', `/parts/${id}`, { auth: false }),
  compare: (offerIds: string[]) =>
    http.list<{ items: (OfferWithSupplier & { part?: Part })[] }>('s2', '/parts/compare', {
      query: { ids: offerIds.join(',') },
      auth: false,
    }),
  myOffers: (q: PageQ) => http.list<Paged<Offer & { part?: Part }>>('s2', '/offers', { query: q }),
  createOffer: (body: {
    partId: string
    price: number
    stock: number
    condition: 'NEW' | 'USED'
    warrantyMonths?: number
    deliveryWilayas?: string[]
  }) => http.post<Offer>('s2', '/offers', body),
  updateOffer: (id: string, body: { price?: number; stock?: number; warrantyMonths?: number; active?: boolean }) =>
    http.patch<Offer>('s2', `/offers/${id}`, body),
  deleteOffer: (id: string) => http.del<void>('s2', `/offers/${id}`),
  placeOrder: (body: {
    items: { offerId: string; qty: number }[]
    deliveryAddress: string
    wilaya: string
    paymentMethod: 'CASH' | 'SANDBOX'
  }) => http.post<Order>('s2', '/orders', body),
  orders: (q: { status?: string } & PageQ) => http.list<Paged<Order>>('s2', '/orders', { query: q }),
  order: (id: string) => http.get<Order>('s2', `/orders/${id}`),
  setOrderStatus: (id: string, status: Exclude<OrderStatus, 'PENDING'>, reason?: string) =>
    http.patch<Order>('s2', `/orders/${id}/status`, { status, reason }),
  reviewOrder: (id: string, rating: number, comment?: string) =>
    http.post<Review>('s2', `/orders/${id}/review`, { rating, comment }),
  supplierReviews: (supplierId: string) =>
    http.get<{ average: number; items: (Review & { authorName?: string })[] }>('s2', `/suppliers/${supplierId}/reviews`, {
      auth: false,
    }),
}
