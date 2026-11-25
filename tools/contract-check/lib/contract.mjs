// Reads the DriveFix contract (OpenAPI files, seed data, shared .env.example).
// Default: the repo's contract/ folder (two levels up). A local ./contract copy, if present, wins
// (used when the tool is copied outside the repo: npm run sync-contract -- <contract folder>).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const REPO_CONTRACT_DIR = join(ROOT, '..', '..', 'contract')
export const DEFAULT_CONTRACT_DIR = existsSync(join(ROOT, 'contract', 'openapi')) ? join(ROOT, 'contract') : REPO_CONTRACT_DIR

export const SERVICES = {
  s1: { file: 's1-identity', name: 'S1 Identity', port: 4001 },
  s2: { file: 's2-parts', name: 'S2 Parts', port: 4002 },
  s3: { file: 's3-mechanic', name: 'S3 Mechanic', port: 4003 },
  s4: { file: 's4-towing', name: 'S4 Towing', port: 4004 },
  s5: { file: 's5-payment', name: 'S5 Payment', port: 4005 },
  s6: { file: 's6-notification', name: 'S6 Notification', port: 4006 },
}

export function loadSpec(service, dir = DEFAULT_CONTRACT_DIR) {
  const file = join(dir, 'openapi', `${SERVICES[service].file}.yaml`)
  if (!existsSync(file)) throw new Error(`Contract file not found: ${file} (run: npm run sync-contract)`)
  return YAML.parse(readFileSync(file, 'utf8'))
}

export function loadSeed(dir = DEFAULT_CONTRACT_DIR) {
  const seed = {}
  for (const f of readdirSync(join(dir, 'seed')).filter((x) => x.endsWith('.json'))) {
    seed[f.slice(0, 2)] = JSON.parse(readFileSync(join(dir, 'seed', f), 'utf8'))
  }
  return seed
}

/** JWT_SECRET and SERVICE_KEY from the shared .env.example (needed to mint negative-test tokens). */
export function loadSharedEnv(dir = DEFAULT_CONTRACT_DIR) {
  const out = {}
  const file = join(dir, '.env.example')
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=([^#\s]*)/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

/** Every operation with the info the checker needs. */
export function operations(spec) {
  const ops = []
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = item[method]
      if (!op) continue
      const roles = String(op.description ?? '').replace(/^Roles:\s*/, '')
      const sec = op.security ?? spec.security ?? []
      const security = sec.some((s) => 'bearerAuth' in s) ? 'bearer' : sec.some((s) => 'serviceKey' in s) ? 'serviceKey' : 'none'
      const optional = /v1\.1, optional/i.test(op.summary ?? '')
      ops.push({ method: method.toUpperCase(), path, op, roles, security, optional, id: `${method.toUpperCase()} ${path}` })
    }
  }
  return ops
}

const ROLE_WORDS = ['TOW_DRIVER', 'DRIVER', 'SUPPLIER', 'MECHANIC', 'DISPATCHER', 'ADMIN']

/** Roles named in "Roles: ..." (TOW_DRIVER is not counted as DRIVER). */
export function parseRoles(roles) {
  const found = []
  const re = /\b(TOW_DRIVER|DRIVER|SUPPLIER|MECHANIC|DISPATCHER|ADMIN)\b/g
  let m
  while ((m = re.exec(roles))) if (!found.includes(m[1])) found.push(m[1])
  return found
}

export const ALL_ROLES = ROLE_WORDS

/** Inline $refs, turn OpenAPI 3.0 `nullable` into JSON Schema, drop doc-only keys. */
export function deref(spec, node, seen = new Set()) {
  if (Array.isArray(node)) return node.map((n) => deref(spec, n, seen))
  if (!node || typeof node !== 'object') return node
  if (node.$ref) {
    const name = node.$ref.split('/').pop()
    if (seen.has(name)) return {}
    return deref(spec, spec.components?.schemas?.[name] ?? {}, new Set([...seen, name]))
  }
  const out = {}
  for (const [k, v] of Object.entries(node)) {
    if (k === 'example' || k === 'description' || k === 'nullable') continue
    out[k] = deref(spec, v, seen)
  }
  if (node.nullable && out.type) out.type = [].concat(out.type, 'null')
  return out
}

/** Response schema for (operation, status), or null when the contract declares no JSON body. */
export function responseSchema(spec, op, status) {
  const r = op.op.responses?.[String(status)]
  const s = r?.content?.['application/json']?.schema
  return s ? deref(spec, s) : null
}

export function declaredStatuses(op) {
  return Object.keys(op.op.responses ?? {}).map(Number)
}
