import { http } from './http'
import type { Application, Language, Paged, User } from './models'

export type RegisterRole = 'DRIVER' | 'SUPPLIER' | 'MECHANIC' | 'TOW_DRIVER'

export interface RegisterBody {
  fullName: string
  phone: string
  password: string
  role: RegisterRole
  language: Language
  businessName?: string
  wilaya?: string
  documentNumber?: string
  vehiclePlate?: string
}

export interface AuthResult {
  token: string
  user: User
}

/** S1 Identity: accounts, OTP, login, admin approval. */
export const s1 = {
  register: (body: RegisterBody) =>
    http.post<{ userId: string; otpSentTo: string }>('s1', '/auth/register', body, { auth: false }),
  verifyOtp: (phone: string, code: string) =>
    http.post<AuthResult>('s1', '/auth/verify-otp', { phone, code }, { auth: false }),
  resendOtp: (phone: string) => http.post<void>('s1', '/auth/resend-otp', { phone }, { auth: false }),
  login: (phone: string, password: string) =>
    http.post<AuthResult>('s1', '/auth/login', { phone, password }, { auth: false }),
  forgotPassword: (phone: string) =>
    http.post<void>('s1', '/auth/forgot-password', { phone }, { auth: false }),
  resetPassword: (phone: string, code: string, newPassword: string) =>
    http.post<void>('s1', '/auth/reset-password', { phone, code, newPassword }, { auth: false }),

  /** v1.1: fresh token with the current `approved` flag (after an admin approval, no new sign-in needed). */
  refresh: () => http.post<AuthResult>('s1', '/auth/refresh'),
  me: () => http.get<User>('s1', '/users/me'),
  updateMe: (body: { fullName?: string; language?: Language }) => http.patch<User>('s1', '/users/me', body),

  applications: (q: { status?: string; page?: number; pageSize?: number }) =>
    http.list<Paged<Application>>('s1', '/admin/applications', { query: q }),
  approve: (id: string) => http.post<Application>('s1', `/admin/applications/${id}/approve`),
  reject: (id: string, reason: string) =>
    http.post<Application>('s1', `/admin/applications/${id}/reject`, { reason }),

  users: (q: { q?: string; role?: string; status?: string; page?: number; pageSize?: number }) =>
    http.list<Paged<User>>('s1', '/admin/users', { query: q }),
  setUserStatus: (id: string, status: 'ACTIVE' | 'SUSPENDED', reason?: string) =>
    http.patch<User>('s1', `/admin/users/${id}/status`, { status, reason }),
}
