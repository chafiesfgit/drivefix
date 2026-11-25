import { http, HttpResponse, type RequestHandler } from 'msw'
import { serviceUrl, type ServiceId } from '@/lib/env'
import { s1Handlers } from './s1'
import { s2Handlers } from './s2'
import { s3Handlers } from './s3'
import { s4Handlers } from './s4'
import { s5Handlers } from './s5'
import { s6Handlers } from './s6'

const HANDLERS: Record<ServiceId, RequestHandler[]> = {
  s1: s1Handlers,
  s2: s2Handlers,
  s3: s3Handlers,
  s4: s4Handlers,
  s5: s5Handlers,
  s6: s6Handlers,
}

/** MSW handlers (+ GET /health) for the given services. Shared by the browser worker and the Node self-test. */
export function handlersFor(ids: ServiceId[]): RequestHandler[] {
  return ids.flatMap((id) => [
    http.get(`${serviceUrl(id).replace(/\/api\/v1$/, '')}/health`, () => HttpResponse.json({ status: 'ok', service: id, mocked: true })),
    ...HANDLERS[id],
  ])
}
