// Minimal HS256 JWT (node:crypto) to mint negative-test tokens: expired, wrong secret, not approved.
import { createHmac } from 'node:crypto'

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

export function signHS256(payload, secret) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const sig = b64url(createHmac('sha256', secret).update(`${head}.${body}`).digest())
  return `${head}.${body}.${sig}`
}

export function decodeJwt(token) {
  try {
    const part = token.split('.')[1]
    return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  } catch {
    return null
  }
}

export function minted({ sub, role, approved = true, expiresIn = 3600 }, secret) {
  const now = Math.floor(Date.now() / 1000)
  return signHS256({ sub, role, approved, iat: now - 60, exp: now + expiresIn, token_type: 'access' }, secret)
}
