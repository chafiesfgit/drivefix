import type { Role } from './roles'

export interface Claims {
  sub: string
  role: Role
  approved: boolean
  exp: number
}

function base64UrlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Reads the claims without verifying the signature (the services verify it). */
export function decodeJwt(token: string): Claims | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const data = JSON.parse(base64UrlDecode(payload)) as Partial<Claims>
    if (!data.sub || !data.role || typeof data.exp !== 'number') return null
    return { sub: data.sub, role: data.role, approved: Boolean(data.approved), exp: data.exp }
  } catch {
    return null
  }
}

export function isExpired(claims: Claims, skewSeconds = 30): boolean {
  return claims.exp * 1000 <= Date.now() + skewSeconds * 1000
}
