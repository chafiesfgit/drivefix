import { http } from './http'
import type { Paged, Payment } from './models'

type PageQ = { page?: number; pageSize?: number }

/** S5 Payment: payment status, sandbox page, cash collection, refunds. */
export const s5 = {
  payments: (q: { refId?: string; status?: string } & PageQ) =>
    http.list<Paged<Payment>>('s5', '/payments', { query: q }),
  payment: (id: string) => http.get<Payment>('s5', `/payments/${id}`),
  session: (token: string) =>
    http.get<{ amount: number; label: string; expiresAt: string; demo: boolean }>('s5', `/pay/${token}`, {
      auth: false,
    }),
  succeed: (token: string) => http.post<Payment>('s5', `/pay/${token}/succeed`, undefined, { auth: false }),
  fail: (token: string) => http.post<Payment>('s5', `/pay/${token}/fail`, undefined, { auth: false }),
  cashCollected: (id: string) => http.post<Payment>('s5', `/payments/${id}/cash-collected`),
  refund: (id: string, reason: string) => http.post<Payment>('s5', `/payments/${id}/refund`, { reason }),
}
