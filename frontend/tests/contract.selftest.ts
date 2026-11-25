// The browser mocks must follow the shared contract: run the teammates' checker against them, in Node.
import { setupServer } from 'msw/node'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { serviceUrl, type ServiceId } from '@/lib/env'
import { handlersFor } from '@/mocks/handlers'
// Shared code: the same engine teammates run (tools/contract-check, needs its `npm install`).
import { loadSharedEnv } from '../../tools/contract-check/lib/contract.mjs'
import { runCheck } from '../../tools/contract-check/lib/engine.mjs'

const SERVICES: ServiceId[] = ['s1', 's2', 's3', 's4', 's5', 's6']
const contractDir = fileURLToPath(new URL('../../contract', import.meta.url))
const server = setupServer(...handlersFor(SERVICES))

beforeAll(() => {
  // The mocks refuse wrong service keys like a real service would.
  vi.stubEnv('VITE_SERVICE_KEY', loadSharedEnv(contractDir).SERVICE_KEY ?? '')
  server.listen({ onUnhandledRequest: 'error' })
})
afterAll(() => {
  server.close()
  vi.unstubAllEnvs()
})

type Result = { status: string; name: string; detail: string }

describe('mocks follow contract v1.1', () => {
  for (const service of SERVICES) {
    it(`${service} mock`, async () => {
      const report = await runCheck({ service, url: serviceUrl(service), s1Url: serviceUrl('s1'), write: true, mode: 'selftest', contractDir })
      const fails = (report.results as Result[]).filter((r) => r.status === 'FAIL')
      if (fails.length) console.log(fails.map((r) => `FAIL ${service} ${r.name}: ${r.detail}`).join('\n'))
      expect(fails.length).toBe(0)
    })
  }
})
