import { http } from 'msw'
import { serviceUrl } from '@/lib/env'
import { db, mutate, sms, uid, type MUser } from '../db'
import { body, err, json, latency, noContent, now, paged, requireRole, serviceKeyError } from './common'

const base = serviceUrl('s1')
const PHONE = /^0[5-7]\d{8}$/
/** Random 6-digit code, like the real S1. Printed in the browser console and kept in the admin SMS log. */
function newCode() {
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
  return code
}

function sendCode(d: Parameters<typeof sms>[0], phone: string, code: string, purpose: 'SIGNUP' | 'RESET') {
  const line = '='.repeat(64)
  console.info(`
${line}
 DriveFix OTP (mocked S1)   phone ${phone}   code ${code}   valid 5 min
${line}`)
  sms(d, phone, purpose === 'SIGNUP' ? `Your DriveFix code is ${code}. Valid for 5 minutes.` : `Your DriveFix reset code is ${code}.`)
}

const normalize = (p = '') => {
  let x = p.replace(/[\s\-.()]/g, '')
  if (x.startsWith('+213')) x = '0' + x.slice(4)
  return x
}

function b64url(obj: unknown) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function token(u: MUser) {
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: u.id, role: u.role, approved: u.approved, exp })}.mock`
}

const out = (u: MUser) => ({
  id: u.id,
  fullName: u.fullName,
  phone: u.phone,
  role: u.role,
  language: u.language,
  status: u.status,
  approved: u.approved,
  createdAt: u.createdAt,
})

export const s1Handlers = [
  http.post(`${base}/auth/register`, async ({ request }) => {
    await latency()
    const b = await body<Record<string, string>>(request)
    const phone = normalize(b.phone)
    if (!b.fullName) return err(400, 'VALIDATION_ERROR', 'Full name is required', 'fullName')
    if (!PHONE.test(phone)) return err(400, 'VALIDATION_ERROR', 'Phone must be an Algerian mobile number', 'phone')
    if (!b.password || b.password.length < 8) return err(400, 'VALIDATION_ERROR', 'At least 8 characters', 'password')
    return mutate((d) => {
      if (d.users.some((u) => u.phone === phone && u.status !== 'PENDING_OTP'))
        return err(409, 'PHONE_TAKEN', 'This phone number already has an account', 'phone')
      d.users = d.users.filter((u) => !(u.phone === phone && u.status === 'PENDING_OTP'))
      const user: MUser = {
        id: uid(),
        fullName: b.fullName!,
        phone,
        role: (b.role as MUser['role']) ?? 'DRIVER',
        language: (b.language as MUser['language']) ?? 'en',
        status: 'PENDING_OTP',
        approved: b.role === 'DRIVER',
        createdAt: now(),
        password: b.password!,
        failed: 0,
      }
      d.users.push(user)
      if (user.role !== 'DRIVER') {
        d.applications.unshift({
          id: uid(),
          userId: user.id,
          role: user.role,
          businessName: b.businessName,
          wilaya: b.wilaya,
          documentNumber: b.documentNumber,
          vehiclePlate: b.vehiclePlate,
          status: 'PENDING',
          createdAt: now(),
        })
      }
      d.otps = d.otps.filter((o) => o.phone !== phone)
      const code = newCode()
      d.otps.push({ phone, code, purpose: 'SIGNUP', expiresAt: Date.now() + 5 * 60000, attempts: 0, sentAt: Date.now() })
      sendCode(d, phone, code, 'SIGNUP')
      return json({ userId: user.id, otpSentTo: phone }, 201)
    })
  }),

  http.post(`${base}/auth/verify-otp`, async ({ request }) => {
    await latency()
    const b = await body<{ phone: string; code: string }>(request)
    const phone = normalize(b.phone)
    return mutate((d) => {
      const otp = d.otps.find((o) => o.phone === phone && o.purpose === 'SIGNUP')
      const user = d.users.find((u) => u.phone === phone)
      if (!otp || !user) return err(422, 'OTP_INVALID', 'Wrong code', 'code')
      if (otp.expiresAt < Date.now()) return err(422, 'OTP_EXPIRED', 'Code expired, request a new one', 'code')
      if (otp.attempts >= 5) return err(422, 'OTP_ATTEMPTS_EXCEEDED', 'Too many attempts, request a new code', 'code')
      if (otp.code !== b.code) {
        otp.attempts++
        if (otp.attempts >= 5) return err(422, 'OTP_ATTEMPTS_EXCEEDED', 'Too many attempts, request a new code', 'code')
        return err(422, 'OTP_INVALID', 'Wrong code', 'code')
      }
      d.otps = d.otps.filter((o) => o !== otp)
      user.status = user.role === 'DRIVER' ? 'ACTIVE' : 'PENDING_APPROVAL'
      user.approved = user.role === 'DRIVER'
      return json({ token: token(user), user: out(user) })
    })
  }),

  http.post(`${base}/auth/resend-otp`, async ({ request }) => {
    await latency()
    const b = await body<{ phone: string }>(request)
    const phone = normalize(b.phone)
    return mutate((d) => {
      const otp = d.otps.find((o) => o.phone === phone)
      if (otp && Date.now() - otp.sentAt < 60000)
        return err(422, 'OTP_RESEND_TOO_SOON', 'Wait 60 seconds before asking for a new code')
      if (otp) {
        Object.assign(otp, { code: newCode(), sentAt: Date.now(), attempts: 0, expiresAt: Date.now() + 5 * 60000 })
        sendCode(d, phone, otp.code, 'SIGNUP')
      }
      return noContent()
    })
  }),

  http.post(`${base}/auth/login`, async ({ request }) => {
    await latency()
    const b = await body<{ phone: string; password: string }>(request)
    const phone = normalize(b.phone)
    return mutate((d) => {
      const user = d.users.find((u) => u.phone === phone)
      if (!user) return err(401, 'INVALID_CREDENTIALS', 'Wrong phone or password')
      if (user.lockedUntil && user.lockedUntil > Date.now()) {
        const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000)
        return err(403, 'ACCOUNT_LOCKED', `Too many failed attempts, try again in ${mins} minute(s)`)
      }
      if (user.password !== b.password) {
        user.failed++
        if (user.failed >= 5) {
          user.failed = 0
          user.lockedUntil = Date.now() + 15 * 60000
          return err(403, 'ACCOUNT_LOCKED', 'Too many failed attempts, locked for 15 minutes')
        }
        return err(401, 'INVALID_CREDENTIALS', 'Wrong phone or password')
      }
      if (user.status === 'PENDING_OTP') return err(403, 'PHONE_NOT_VERIFIED', 'Phone not verified yet')
      if (user.status === 'SUSPENDED') return err(403, 'ACCOUNT_SUSPENDED', 'Account suspended, contact support')
      user.failed = 0
      user.lockedUntil = undefined
      return json({ token: token(user), user: out(user) })
    })
  }),

  http.post(`${base}/auth/forgot-password`, async ({ request }) => {
    await latency()
    const b = await body<{ phone: string }>(request)
    const phone = normalize(b.phone)
    if (!PHONE.test(phone)) return err(400, 'VALIDATION_ERROR', 'Phone must be an Algerian mobile number', 'phone')
    mutate((d) => {
      if (!d.users.some((u) => u.phone === phone)) return
      d.otps = d.otps.filter((o) => !(o.phone === phone && o.purpose === 'RESET'))
      const code = newCode()
      d.otps.push({ phone, code, purpose: 'RESET', expiresAt: Date.now() + 5 * 60000, attempts: 0, sentAt: Date.now() })
      sendCode(d, phone, code, 'RESET')
    })
    return noContent()
  }),

  http.post(`${base}/auth/reset-password`, async ({ request }) => {
    await latency()
    const b = await body<{ phone: string; code: string; newPassword: string }>(request)
    const phone = normalize(b.phone)
    if (!b.newPassword || b.newPassword.length < 8) return err(400, 'VALIDATION_ERROR', 'At least 8 characters', 'newPassword')
    return mutate((d) => {
      const otp = d.otps.find((o) => o.phone === phone && o.purpose === 'RESET')
      const user = d.users.find((u) => u.phone === phone)
      if (!otp || !user) return err(422, 'OTP_INVALID', 'Wrong code', 'code')
      if (otp.expiresAt < Date.now()) return err(422, 'OTP_EXPIRED', 'Code expired', 'code')
      if (otp.code !== b.code) {
        otp.attempts++
        return err(422, otp.attempts >= 5 ? 'OTP_ATTEMPTS_EXCEEDED' : 'OTP_INVALID', 'Wrong code', 'code')
      }
      d.otps = d.otps.filter((o) => o !== otp)
      user.password = b.newPassword!
      user.failed = 0
      user.lockedUntil = undefined
      return noContent()
    })
  }),

  /** v1.1: fresh token with the current approved flag (no new login after an admin approval). */
  http.post(`${base}/auth/refresh`, async ({ request }) => {
    await latency()
    const g = requireRole(request, 'any')
    if (!g.ok) return g.res
    const user = db().users.find((u) => u.id === g.c.sub)
    if (!user) return err(401, 'UNAUTHORIZED', 'Account no longer exists')
    if (user.status === 'SUSPENDED') return err(403, 'ACCOUNT_SUSPENDED', 'Account suspended')
    return json({ token: token(user), user: out(user) })
  }),

  http.get(`${base}/users/me`, async ({ request }) => {
    await latency()
    const g = requireRole(request, 'any')
    if (!g.ok) return g.res
    const u = db().users.find((x) => x.id === g.c.sub)
    return u ? json(out(u)) : err(404, 'NOT_FOUND', 'User not found')
  }),

  http.patch(`${base}/users/me`, async ({ request }) => {
    await latency()
    const g = requireRole(request, 'any')
    if (!g.ok) return g.res
    const b = await body<{ fullName: string; language: MUser['language'] }>(request)
    return mutate((d) => {
      const u = d.users.find((x) => x.id === g.c.sub)
      if (!u) return err(404, 'NOT_FOUND', 'User not found')
      if (b.fullName) u.fullName = b.fullName
      if (b.language) u.language = b.language
      return json(out(u))
    })
  }),

  http.get(`${base}/admin/applications`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['ADMIN'])
    if (!g.ok) return g.res
    const status = new URL(request.url).searchParams.get('status') || 'PENDING'
    const d = db()
    const items = d.applications
      .filter((a) => status === 'ALL' || a.status === status)
      .map((a) => {
        const u = d.users.find((x) => x.id === a.userId)
        return { ...a, fullName: u?.fullName, phone: u?.phone }
      })
    return paged(items, request)
  }),

  http.post(`${base}/admin/applications/:id/:action`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['ADMIN'])
    if (!g.ok) return g.res
    const b = await body<{ reason: string }>(request)
    return mutate((d) => {
      const a = d.applications.find((x) => x.id === params.id)
      if (!a) return err(404, 'NOT_FOUND', 'Application not found')
      if (a.status !== 'PENDING') return err(409, 'STATE_CONFLICT', 'Application already decided')
      const u = d.users.find((x) => x.id === a.userId)
      if (params.action === 'reject') {
        if (!b.reason?.trim()) return err(400, 'VALIDATION_ERROR', 'Reason is required', 'reason')
        a.status = 'REJECTED'
        a.reason = b.reason
      } else {
        a.status = 'APPROVED'
        if (u) {
          u.approved = true
          u.status = 'ACTIVE'
        }
      }
      return json({ ...a, fullName: u?.fullName, phone: u?.phone })
    })
  }),

  http.get(`${base}/admin/users`, async ({ request }) => {
    await latency()
    const g = requireRole(request, ['ADMIN'])
    if (!g.ok) return g.res
    const sp = new URL(request.url).searchParams
    const q = (sp.get('q') ?? '').toLowerCase()
    const role = sp.get('role')
    const status = sp.get('status')
    const items = db()
      .users.filter((u) => !q || u.fullName.toLowerCase().includes(q) || u.phone.includes(q))
      .filter((u) => !role || u.role === role)
      .filter((u) => !status || u.status === status)
      .map(out)
    return paged(items, request)
  }),

  http.patch(`${base}/admin/users/:id/status`, async ({ request, params }) => {
    await latency()
    const g = requireRole(request, ['ADMIN'])
    if (!g.ok) return g.res
    const b = await body<{ status: 'ACTIVE' | 'SUSPENDED' }>(request)
    if (b.status !== 'ACTIVE' && b.status !== 'SUSPENDED') return err(400, 'VALIDATION_ERROR', 'Invalid status', 'status')
    if (params.id === g.c.sub) return err(409, 'STATE_CONFLICT', 'You cannot suspend yourself')
    return mutate((d) => {
      const u = d.users.find((x) => x.id === params.id)
      if (!u) return err(404, 'NOT_FOUND', 'User not found')
      u.status = b.status!
      return json(out(u))
    })
  }),
  /** Service-to-service: name and phone for orders, bookings and tows. */
  http.get(`${base}/users/:id/public`, ({ request, params }) => {
    const denied = serviceKeyError(request)
    if (denied) return denied
    const u = db().users.find((x) => x.id === params.id)
    if (!u) return err(404, 'NOT_FOUND', 'User not found')
    return json({ id: u.id, fullName: u.fullName, phone: u.phone })
  }),
]
