import { http } from 'msw'
import { serviceUrl } from '@/lib/env'
import { db, mutate, sms, uid } from '../db'
import seed from '../seed/s6-notification.json'
import { body, err, json, latency, noContent, paged, requireRole, serviceKeyError } from './common'

const base = serviceUrl('s6')

export const s6Handlers = [
  http.get(`${base}/notifications/unread-count`, async ({ request }) => {
    const g = requireRole(request, 'any')
    if (!g.ok) return g.res
    return json({ count: db().notifications.filter((n) => n.userId === g.c.sub && !n.read).length })
  }),

  http.get(`${base}/notifications`, async ({ request }) => {
    await latency()
    const g = requireRole(request, 'any')
    if (!g.ok) return g.res
    const unread = new URL(request.url).searchParams.get('unread') === 'true'
    const items = db()
      .notifications.filter((n) => n.userId === g.c.sub && (!unread || !n.read))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return paged(items, request)
  }),

  http.patch(`${base}/notifications/:id/read`, async ({ request, params }) => {
    const g = requireRole(request, 'any')
    if (!g.ok) return g.res
    return mutate((d) => {
      const n = d.notifications.find((x) => x.id === params.id)
      if (!n) return err(404, 'NOT_FOUND', 'Notification not found')
      if (n.userId !== g.c.sub) return err(403, 'FORBIDDEN', 'Not your notification')
      n.read = true
      return json(n)
    })
  }),

  http.post(`${base}/notifications/read-all`, async ({ request }) => {
    const g = requireRole(request, 'any')
    if (!g.ok) return g.res
    mutate((d) => d.notifications.filter((n) => n.userId === g.c.sub).forEach((n) => (n.read = true)))
    return noContent()
  }),

  http.get(`${base}/admin/sms-log`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['ADMIN'])
    if (!g.ok) return g.res
    return paged(db().sms, request)
  }),
  /** Service-to-service: create an in-app notification from a template (type + language + variables). */
  http.post(`${base}/notifications`, async ({ request }) => {
    const denied = serviceKeyError(request)
    if (denied) return denied
    const b = await body<{ userId: string; type: string; variables?: Record<string, string>; language?: 'ar' | 'fr' | 'en' }>(request)
    if (!b.userId || !b.type) return err(400, 'VALIDATION_ERROR', 'userId and type are required')
    const lang = b.language ?? 'fr'
    const all = seed.templates.filter((t) => t.type === b.type)
    const tpl = all.find((t) => t.language === lang) ?? all.find((t) => t.language === 'en')
    const vars = b.variables ?? {}
    const fill = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ''))
    if (tpl) {
      const missing = [...`${tpl.title} ${tpl.body}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((k) => vars[k] === undefined)
      if (missing.length) return err(400, 'VALIDATION_ERROR', `Missing variable(s): ${missing.join(', ')}`, 'variables')
    }
    return mutate((d) => {
      const n = { id: uid(), userId: b.userId!, type: b.type!, title: tpl ? fill(tpl.title) : b.type!, body: tpl ? fill(tpl.body) : JSON.stringify(vars), read: false, createdAt: new Date().toISOString() }
      d.notifications.unshift(n)
      return json({ ...n, language: lang }, 201)
    })
  }),
  /** Service-to-service: mock SMS, printed and kept in the SMS log. */
  http.post(`${base}/sms`, async ({ request }) => {
    const denied = serviceKeyError(request)
    if (denied) return denied
    const b = await body<{ phone: string; text: string }>(request)
    if (!b.phone || !b.text) return err(400, 'VALIDATION_ERROR', 'phone and text are required')
    return mutate((d) => {
      sms(d, b.phone!, b.text!)
      return json({ id: d.sms[0].id, status: 'SENT' })
    })
  }),
]
