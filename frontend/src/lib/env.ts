export type ServiceId = 's1' | 's2' | 's3' | 's4' | 's5' | 's6'

export const SERVICE_IDS: ServiceId[] = ['s1', 's2', 's3', 's4', 's5', 's6']

export const SERVICE_NAMES: Record<ServiceId, string> = {
  s1: 'Identity',
  s2: 'Parts',
  s3: 'Mechanic',
  s4: 'Towing',
  s5: 'Payment',
  s6: 'Notification',
}

const env = import.meta.env

const URLS: Record<ServiceId, string> = {
  s1: env.VITE_S1_URL || 'http://localhost:4001/api/v1',
  s2: env.VITE_S2_URL || 'http://localhost:4002/api/v1',
  s3: env.VITE_S3_URL || 'http://localhost:4003/api/v1',
  s4: env.VITE_S4_URL || 'http://localhost:4004/api/v1',
  s5: env.VITE_S5_URL || 'http://localhost:4005/api/v1',
  s6: env.VITE_S6_URL || 'http://localhost:4006/api/v1',
}

const FLAGS: Record<ServiceId, string | undefined> = {
  s1: env.VITE_MOCK_S1,
  s2: env.VITE_MOCK_S2,
  s3: env.VITE_MOCK_S3,
  s4: env.VITE_MOCK_S4,
  s5: env.VITE_MOCK_S5,
  s6: env.VITE_MOCK_S6,
}

/** S1 is real by default, S2-S6 are mocked until teammates are ready. */
const DEFAULT_MOCKED: Record<ServiceId, boolean> = {
  s1: false,
  s2: true,
  s3: true,
  s4: true,
  s5: true,
  s6: true,
}

export const mocksEnabled = env.VITE_USE_MOCKS !== 'false'

export function serviceUrl(id: ServiceId): string {
  return URLS[id].replace(/\/+$/, '')
}

export function isMocked(id: ServiceId): boolean {
  if (!mocksEnabled) return false
  const flag = FLAGS[id]
  if (flag === 'true') return true
  if (flag === 'false') return false
  return DEFAULT_MOCKED[id]
}
