import { z } from 'zod'
import i18n from '@/i18n'
import { normalizePhone, PHONE_RE } from '@/lib/format'

const t = (k: string) => i18n.t(k)

export const phoneSchema = z
  .string()
  .trim()
  .min(1, { message: 'validation.required' })
  .transform((v) => normalizePhone(v))
  .refine((v) => PHONE_RE.test(v), { message: 'validation.phone' })

export const passwordSchema = z.string().min(8, { message: 'validation.passwordMin' }).max(128)

/** zod messages are i18n keys; translate at render time so they follow the language. */
export function tr(message?: string) {
  return message ? t(message) : undefined
}

/** Remembers the phone between register -> verify (survives a page refresh). */
export const pendingSignup = {
  save(data: { phone: string; role: string }) {
    try {
      sessionStorage.setItem('df.signup', JSON.stringify({ ...data, at: Date.now() }))
    } catch {
      /* ignore */
    }
  },
  load(): { phone: string; role: string; at: number } | null {
    try {
      const raw = sessionStorage.getItem('df.signup')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  clear() {
    try {
      sessionStorage.removeItem('df.signup')
    } catch {
      /* ignore */
    }
  },
}
