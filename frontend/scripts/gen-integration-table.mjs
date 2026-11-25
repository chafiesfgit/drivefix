// Prints, per service, the endpoints the frontend calls (from src/api/s1..s6.ts) and the response fields it reads
// (contract schema behind each model in src/api/models.ts, plus the optional extras the UI shows when present).
// Usage: node scripts/gen-integration-table.mjs > integration-table.md   (pasted into ../docs/INTEGRATION.md, section 3)
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contract = join(root, '..', 'contract', 'openapi')
// YAML parser borrowed from the contract-check tool (no new dependency in the frontend).
const YAML = createRequire(join(root, '..', 'tools', 'contract-check', 'package.json'))('yaml')

const FILES = { s1: 's1-identity', s2: 's2-parts', s3: 's3-mechanic', s4: 's4-towing', s5: 's5-payment', s6: 's6-notification' }
const NAMES = { s1: 'S1 Identity', s2: 'S2 Parts', s3: 'S3 Mechanic', s4: 'S4 Towing', s5: 'S5 Payment', s6: 'S6 Notification' }
const specs = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, YAML.parse(readFileSync(join(contract, `${f}.yaml`), 'utf8'))]))

// model name -> [service, contract schema]
const SCHEMA = {
  User: ['s1', 'User'], Application: ['s1', 'Application'], Part: ['s2', 'Part'], Offer: ['s2', 'Offer'], OfferWithSupplier: ['s2', 'Offer'],
  Order: ['s2', 'Order'], OrderLine: ['s2', 'OrderItem'], Review: ['s2', 'Review'], MechanicProfile: ['s3', 'MechanicProfile'],
  MechanicService: ['s3', 'Service'], Booking: ['s3', 'Booking'], TowRequest: ['s4', 'TowRequest'], TowOffer: ['s4', 'TowOffer'],
  Position: ['s4', 'Position'], Payment: ['s5', 'Payment'], Notification: ['s6', 'Notification'],
}

const models = readFileSync(join(root, 'src', 'api', 'models.ts'), 'utf8')
/** Optional extras the frontend declares on top of the contract (e.g. Booking.serviceName). */
function extras(name) {
  const m = models.match(new RegExp(`export (?:type|interface) ${name}\\b[^{]*\\{([^}]*)\\}`))
  if (!m) return []
  return [...m[1].matchAll(/(?:^|[;,])\s*(\w+)\??\s*:/gm)].map((x) => x[1]).filter((k) => k !== 'items')
}
function contractFields(name) {
  const ref = SCHEMA[name]
  if (!ref) return []
  const schema = specs[ref[0]].components?.schemas?.[ref[1]]
  if (!schema?.properties) return []
  const req = new Set(schema.required ?? [])
  return Object.keys(schema.properties).map((k) => (req.has(k) ? `${k}*` : k))
}

const calls = {}
const used = {}
for (const svc of Object.keys(FILES)) {
  const src = readFileSync(join(root, 'src', 'api', `${svc}.ts`), 'utf8')
  const re = /(\w+):\s*\([^)]*\)\s*=>\s*http\.(get|list|post|put|patch|del)<([\s\S]*?)>\(\s*'s\d',\s*[`']([^`']+)[`']/g
  calls[svc] = []
  used[svc] = new Set()
  for (const m of src.matchAll(re)) {
    const [, fn, verb, type, path] = m
    const method = { get: 'GET', list: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', del: 'DELETE' }[verb]
    const cleanPath = path.replace(/\$\{[^}]+\}/g, '{id}')
    const t = type.replace(/\s+/g, ' ').trim()
    for (const name of Object.keys(SCHEMA).concat(['MechanicReview', 'TowDriverInfo'])) if (new RegExp(`\\b${name}\\b`).test(t)) used[svc].add(name)
    calls[svc].push({ fn: `${svc}.${fn}`, endpoint: `${method} ${cleanPath}`, type: t === 'void' ? '(no body: 204)' : t })
  }
}

const out = []
for (const svc of Object.keys(FILES)) {
  out.push(`### ${NAMES[svc]}`, '', '| Frontend call | Endpoint | Response it expects |', '| --- | --- | --- |')
  for (const c of calls[svc]) out.push(`| \`${c.fn}\` | \`${c.endpoint}\` | \`${c.type.replace(/\|/g, '\\|')}\` |`)
  if (used[svc].size) {
    out.push('', '| Object | Contract fields it reads (`*` = required) | Optional extras shown when present |', '| --- | --- | --- |')
    for (const name of used[svc]) {
      const cf = contractFields(name)
      const ex = extras(name).filter((e) => !cf.map((f) => f.replace('*', '')).includes(e))
      out.push(`| ${name} | ${cf.join(', ') || '(free-form)'} | ${ex.join(', ') || '-'} |`)
    }
  }
  out.push('')
}
console.log(out.join('\n'))
