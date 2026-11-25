import { http } from './http'
import type { Notification, Paged } from './models'

type PageQ = { page?: number; pageSize?: number }

/** S6 Notification: bell, list, SMS log. */
export const s6 = {
  list: (q: { unread?: boolean } & PageQ) => http.list<Paged<Notification>>('s6', '/notifications', { query: q }),
  unreadCount: () => http.get<{ count: number }>('s6', '/notifications/unread-count'),
  markRead: (id: string) => http.patch<Notification>('s6', `/notifications/${id}/read`),
  markAllRead: () => http.post<void>('s6', '/notifications/read-all'),
  smsLog: (q: PageQ) =>
    http.list<{ items: { id: string; phone: string; text: string; status: string; createdAt: string }[] }>(
      's6',
      '/admin/sms-log',
      { query: q },
    ),
}
