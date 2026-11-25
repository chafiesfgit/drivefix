import { useSyncExternalStore } from 'react'
import type { User } from '@/api/models'
import { decodeJwt, isExpired, type Claims } from './jwt'
import { NEEDS_APPROVAL } from './roles'

const TOKEN_KEY = 'df.token'
const USER_KEY = 'df.user'

export interface AuthState {
  token: string | null
  claims: Claims | null
  user: User | null
}

export type LogoutReason = 'manual' | 'expired' | 'suspended'

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* private mode: memory only */
  }
}

const EMPTY: AuthState = { token: null, claims: null, user: null }

function load(): AuthState {
  const token = safeGet(TOKEN_KEY)
  const claims = token ? decodeJwt(token) : null
  if (!token || !claims || isExpired(claims)) {
    safeSet(TOKEN_KEY, null)
    safeSet(USER_KEY, null)
    return EMPTY
  }
  let user: User | null = null
  try {
    const raw = safeGet(USER_KEY)
    user = raw ? (JSON.parse(raw) as User) : null
  } catch {
    user = null
  }
  return { token, claims, user }
}

let state: AuthState = load()
const listeners = new Set<() => void>()
const logoutListeners = new Set<(reason: LogoutReason) => void>()

function emit() {
  listeners.forEach((l) => l())
}

export const authStore = {
  getState: (): AuthState => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  onLogout(listener: (reason: LogoutReason) => void) {
    logoutListeners.add(listener)
    return () => {
      logoutListeners.delete(listener)
    }
  },
  getToken(): string | null {
    if (state.claims && isExpired(state.claims)) {
      authStore.logout('expired')
      return null
    }
    return state.token
  },
  login(token: string, user: User) {
    const claims = decodeJwt(token)
    if (!claims) throw new Error('Invalid token received')
    state = { token, claims, user }
    safeSet(TOKEN_KEY, token)
    safeSet(USER_KEY, JSON.stringify(user))
    emit()
  },
  setUser(user: User) {
    state = { ...state, user }
    safeSet(USER_KEY, JSON.stringify(user))
    emit()
  },
  logout(reason: LogoutReason = 'manual') {
    if (!state.token) return
    state = EMPTY
    safeSet(TOKEN_KEY, null)
    safeSet(USER_KEY, null)
    emit()
    logoutListeners.forEach((l) => l(reason))
  },
}

// Keep tabs in sync: logging out in one tab logs out the others.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === TOKEN_KEY || e.key === USER_KEY) {
      state = load()
      emit()
    }
  })
}

export function useAuth() {
  const s = useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getState)
  const role = s.claims?.role ?? null
  const approved = s.claims?.approved ?? false
  return {
    ...s,
    role,
    approved,
    isAuthenticated: Boolean(s.token),
    needsApproval: role ? NEEDS_APPROVAL.includes(role) && !approved : false,
  }
}
