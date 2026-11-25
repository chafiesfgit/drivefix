import { setupWorker } from 'msw/browser'
import { isMocked, SERVICE_IDS, type ServiceId } from '@/lib/env'
import { handlersFor } from './handlers'

/** Starts MSW only for the services flagged as mocked. Real services are never intercepted. */
export async function startMocks(): Promise<ServiceId[]> {
  const mocked = SERVICE_IDS.filter(isMocked)
  if (mocked.length === 0) return []
  const handlers = handlersFor(mocked)
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
  console.info(`[DriveFix] mocked services: ${mocked.join(', ')} — real: ${SERVICE_IDS.filter((s) => !mocked.includes(s)).join(', ') || 'none'}`)
  return mocked
}
