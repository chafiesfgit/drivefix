// The checker. Used by the CLI (live services) and by the frontend's mock self-test (mode: 'selftest').
import { randomUUID } from 'node:crypto'
import { declaredStatuses, loadSeed, loadSharedEnv, loadSpec, operations, parseRoles, responseSchema, SERVICES } from './contract.mjs'
import { call } from './http.mjs'
import { minted, signHS256 } from './jwt.mjs'
import { SCENARIOS } from './scenarios.mjs'
import { badKeys, envelopeProblems, errorProblems, isPagedSchema, schemaProblems } from './validate.mjs'

export const ORIGIN = 'http://localhost:5173'
export const PASSWORD = 'Password123'
export const ACCOUNTS = {
  ADMIN: '0555000001',
  DRIVER: '0555000002',
  DRIVER2: '0555000003',
  SUPPLIER: '0555000004',
  SUPPLIER_PENDING: '0555000011',
  MECHANIC: '0555000006',
  TOW_DRIVER: '0555000008',
  TOW_DRIVER2: '0555000009',
  DISPATCHER: '0555000010',
}
const ACCEPTED_401 = ['UNAUTHORIZED', 'TOKEN_INVALID', 'TOKEN_EXPIRED']

function seedIds(seed) {
  const users = Object.fromEntries((seed.s1?.users ?? []).map((u) => [u.phone, u.id]))
  const s2 = seed.s2 ?? {}
  const supplier = users[ACCOUNTS.SUPPLIER]
  return {
    user: (phone) => users[phone],
    part: s2.parts?.[0]?.id,
    offers: (s2.offers ?? []).map((o) => o.id),
    supplierOffer: (s2.offers ?? []).find((o) => o.supplierId === supplier)?.id,
    order: s2.orders?.[0]?.id,
    supplier,
    mechanic: users[ACCOUNTS.MECHANIC],
    service: seed.s3?.services?.find((s) => s.mechanicId === users[ACCOUNTS.MECHANIC])?.id,
    booking: seed.s3?.bookings?.[0]?.id,
    tow: seed.s4?.tow_requests?.[0]?.id,
    trackingCode: seed.s4?.tow_requests?.[0]?.trackingCode,
    payment: seed.s5?.payments?.[0]?.id,
    notification: seed.s6?.notifications?.[0]?.id,
    application: seed.s1?.applications?.[0]?.id,
  }
}

/** A date a few days ahead that is not a Friday (seed garages work Saturday to Thursday). */
export function bookingDate(daysAhead = 3) {
  const d = new Date(Date.now() + daysAhead * 86400000)
  if (d.getUTCDay() === 5) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function idFor(ctx, segment) {
  const i = ctx.ids
  return (
    {
      parts: i.part,
      offers: i.supplierOffer,
      orders: i.order,
      suppliers: i.supplier,
      mechanics: i.mechanic,
      services: i.service,
      bookings: i.booking,
      tows: i.tow,
      payments: i.payment,
      pay: 'contract-check-token',
      notifications: i.notification,
      applications: i.application,
      users: i.user(ACCOUNTS.DRIVER),
    }[segment] ?? randomUUID()
  )
}

export function fillPath(ctx, path) {
  const segs = path.split('/')
  return segs.map((s, n) => (s.startsWith('{') ? encodeURIComponent(idFor(ctx, segs[n - 1])) : s)).join('/')
}

function readQuery(ctx, op) {
  const names = (op.op.parameters ?? []).filter((p) => p.in === 'query').map((p) => p.name)
  const q = {}
  if (names.includes('page')) Object.assign(q, { page: 1, pageSize: 5 })
  if (op.path === '/parts/compare') q.ids = ctx.ids.offers.slice(0, 2).join(',')
  if (op.path === '/mechanics/{id}/slots') Object.assign(q, { date: bookingDate(), serviceId: ctx.ids.service })
  return q
}

/** Token (or service key) of a role the contract allows, for a successful call. */
function allowedAuth(ctx, op) {
  if (op.security === 'serviceKey') return { headers: { 'X-Service-Key': ctx.env.SERVICE_KEY } }
  if (op.security === 'none') return {}
  const r = op.roles
  if (/any authenticated/i.test(r)) return { token: ctx.tokens.DRIVER }
  if (/^owner/i.test(r) && op.path.startsWith('/payments')) return { token: ctx.tokens.DRIVER }
  const roles = parseRoles(r)
  const role = op.path.startsWith('/tows') && roles.includes('DISPATCHER') ? 'DISPATCHER' : roles[0]
  return { token: ctx.tokens[role] ?? ctx.tokens.DRIVER }
}

const brief = (res) => (res.networkError ? `network error: ${res.networkError}` : `${res.status}${res.json?.error?.code ? ` ${res.json.error.code}` : ''}`)

/** Validate a response against the contract for (op, status). Returns problems (empty = OK). */
export function responseProblems(ctx, op, res) {
  if (res.networkError) return [`network error: ${res.networkError}`]
  const declared = declaredStatuses(op)
  const p = []
  if (!declared.includes(res.status)) p.push(`status ${res.status} is not in the contract (declared: ${declared.join(', ')})`)
  if (res.status === 204 || res.status === 0) return p
  if (res.text && res.json === undefined) return [...p, `body is not JSON (${(res.headers['content-type'] ?? 'no content-type').split(';')[0]}): return JSON, never an HTML page`]
  if (res.status >= 400) return [...p, ...errorProblems(res.json)]
  const schema = responseSchema(ctx.spec, op, res.status)
  p.push(...schemaProblems(schema, res.json))
  if (isPagedSchema(schema)) p.push(...envelopeProblems(res.json))
  const keys = badKeys(res.json)
  if (keys.length) p.push(`keys must be camelCase: ${keys.join(', ')}`)
  return p
}

export async function runCheck({ service, url, s1Url, write = false, mode = 'live', fetchImpl = globalThis.fetch, contractDir, onResult = () => {} }) {
  const results = []
  const add = (r) => {
    results.push(r)
    onResult(r)
  }
  const spec = loadSpec(service, contractDir)
  const ctx = {
    service,
    url,
    s1Url,
    spec,
    mode,
    env: loadSharedEnv(contractDir),
    ids: seedIds(loadSeed(contractDir)),
    tokens: {},
    add,
    fetchImpl,
    ops: operations(spec),
    call: (opts) => call(fetchImpl, url, opts),
    callS1: (opts) => call(fetchImpl, s1Url, opts),
  }
  ctx.op = (id) => ctx.ops.find((o) => o.id === id)
  const meta = { service, name: SERVICES[service].name, url, s1Url, write, mode, contractVersion: spec.info?.version, at: new Date().toISOString() }
  const finish = () => ({ results, meta, summary: summarize(results) })

  if (!(await getTokens(ctx))) return finish()
  if (!(await checkHealth(ctx))) return finish()
  if (mode === 'live') await checkCors(ctx)
  await checkReads(ctx)
  await checkSecurity(ctx)
  if (write) await runScenario(ctx)
  return finish()
}

export function summarize(results) {
  const s = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 }
  for (const r of results) s[r.status] = (s[r.status] ?? 0) + 1
  return s
}

async function getTokens(ctx) {
  for (const [role, phone] of Object.entries(ACCOUNTS)) {
    const res = await ctx.callS1({ method: 'POST', path: '/auth/login', body: { phone, password: PASSWORD } })
    if (res.networkError) {
      ctx.add({ group: 'Setup', name: 'Log in to S1', status: 'FAIL', detail: `S1 is not reachable at ${ctx.s1Url} (${res.networkError})`, fix: 'Start S1 (run.ps1), check the --s1 URL, the firewall (port 4001) and that both PCs are on the same Wi-Fi.' })
      return false
    }
    if (res.status !== 200 || !res.json?.token) {
      ctx.add({ group: 'Setup', name: `Log in as ${role} (${phone})`, status: 'FAIL', detail: `S1 answered ${brief(res)}`, fix: 'Load the shared seed in S1 (manage.py seed). All demo accounts use Password123.' })
      return false
    }
    ctx.tokens[role] = res.json.token
  }
  ctx.add({ group: 'Setup', name: 'Log in to S1 with the 9 seed accounts', status: 'PASS', detail: `tokens from ${ctx.s1Url}` })
  return true
}

async function checkHealth(ctx) {
  const root = ctx.url.replace(/\/api\/v1\/?$/, '')
  let res = await call(ctx.fetchImpl, root, { path: '/health' })
  if (res.status !== 200) res = await ctx.call({ path: '/health' })
  if (res.networkError) {
    ctx.add({ group: 'Health', name: 'GET /health', status: 'FAIL', detail: `${SERVICES[ctx.service].name} is not reachable at ${ctx.url} (${res.networkError})`, fix: 'Start the service on 0.0.0.0 (all interfaces), check the URL, open the port in Windows Firewall, same Wi-Fi.' })
    return false
  }
  const ok = res.status === 200 && res.json?.status === 'ok'
  ctx.add({ group: 'Health', name: 'GET /health', status: ok ? 'PASS' : 'FAIL', detail: ok ? `${res.ms} ms` : `got ${brief(res)} ${JSON.stringify(res.json ?? res.text).slice(0, 80)}`, fix: ok ? undefined : 'Answer 200 {"status":"ok"} without a token.' })
  return true
}

async function checkCors(ctx) {
  const used = [...new Set(ctx.ops.map((o) => o.method))]
  const first = ctx.ops.find((o) => o.method === 'GET') ?? ctx.ops[0]
  const path = fillPath(ctx, first.path)
  const pre = await ctx.call({ method: 'OPTIONS', path, headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } })
  const h = pre.headers
  const problems = []
  const allowOrigin = h['access-control-allow-origin']
  if (allowOrigin !== ORIGIN && allowOrigin !== '*') problems.push(`Access-Control-Allow-Origin is ${allowOrigin ? `"${allowOrigin}"` : 'missing'}`)
  const allowHeaders = (h['access-control-allow-headers'] ?? '').toLowerCase()
  for (const need of ['authorization', 'content-type']) if (allowHeaders !== '*' && !allowHeaders.includes(need)) problems.push(`Access-Control-Allow-Headers does not list ${need}`)
  const allowMethods = (h['access-control-allow-methods'] ?? '').toUpperCase()
  const missing = used.filter((m) => m !== 'GET' && allowMethods !== '*' && !allowMethods.includes(m))
  if (missing.length) problems.push(`Access-Control-Allow-Methods misses ${missing.join(', ')}`)
  if (pre.status >= 400) problems.push(`preflight answered ${pre.status}`)
  ctx.add({
    group: 'CORS',
    name: `Preflight from ${ORIGIN}`,
    status: problems.length ? 'FAIL' : 'PASS',
    detail: problems.length ? problems.join('; ') : `allows ${ORIGIN}, Authorization, Content-Type, ${used.join('/')}`,
    fix: problems.length ? `Enable CORS: add ${ORIGIN} to CORS_ORIGIN, allow headers Authorization + Content-Type and methods ${used.join(', ')}. Without it the browser blocks every call.` : undefined,
  })
}

async function checkReads(ctx) {
  for (const op of ctx.ops.filter((o) => o.method === 'GET')) {
    if (op.path.includes('{token}')) {
      ctx.add({ group: 'Read', name: op.id, status: 'SKIP', detail: 'needs a sandbox session token: covered by --write' })
      continue
    }
    const res = await ctx.call({ path: fillPath(ctx, op.path), query: readQuery(ctx, op), ...allowedAuth(ctx, op) })
    if (op.optional && [404, 405, 501].includes(res.status)) {
      ctx.add({ group: 'Read', name: op.id, status: 'WARN', detail: `optional v1.1 endpoint not implemented (${res.status})`, fix: 'Optional: implement it (see CHANGELOG v1.1); the frontend falls back without it.' })
      continue
    }
    const problems = responseProblems(ctx, op, res)
    if (!problems.length && res.status === 404 && op.path !== '/tow-drivers/me/offer') problems.push('404 for a seed id: load the shared seed data (one command)')
    ctx.add({ group: 'Read', name: op.id, status: problems.length ? 'FAIL' : 'PASS', detail: problems.length ? problems.join('; ') : `${res.status} in ${res.ms} ms`, fix: problems.length ? fixFor(problems) : undefined })
  }
}

function fixFor(problems) {
  const t = problems.join(' ')
  if (/network error/.test(t)) return 'Is the service running and reachable from this PC?'
  if (/camelCase/.test(t)) return 'Use camelCase JSON keys (e.g. deliveryFee, not delivery_fee).'
  if (/uuid/.test(t)) return 'Ids must be UUID strings, never numbers.'
  if (/integer/.test(t)) return 'Money is an integer number of DZD (4500, not 4500.0 or "4500").'
  if (/date-time/.test(t)) return 'Dates in ISO 8601 UTC, e.g. 2026-11-25T14:30:00Z.'
  if (/items, page, pageSize, total/.test(t)) return 'Lists answer { items, page, pageSize, total }.'
  if (/error body|error\.code/.test(t)) return 'Errors answer { "error": { "code": "UPPER_SNAKE", "message": "...", "field": "..." } }.'
  if (/not in the contract/.test(t)) return 'Return one of the status codes the contract declares for this operation.'
  return 'Compare your response with the contract (openapi/*.yaml, paste it into editor.swagger.io).'
}

async function checkSecurity(ctx) {
  // Guests may call these without a token (guest SOS, tracking by code): no token is not an error there.
  const bearer = ctx.ops.filter((o) => o.security === 'bearer' && !/guest|trackingCode/i.test(o.roles))
  const keyed = ctx.ops.filter((o) => o.security === 'serviceKey')
  const driver = ctx.ids.user(ACCOUNTS.DRIVER)
  const secret = ctx.env.JWT_SECRET
  const now = Math.floor(Date.now() / 1000)
  const expired = secret ? signHS256({ sub: driver, role: 'DRIVER', approved: true, iat: now - 7200, exp: now - 3600, token_type: 'access' }, secret) : null
  const wrongSecret = minted({ sub: driver, role: 'DRIVER' }, 'this-is-not-the-shared-jwt-secret-000000')
  const req = (op, extra) => ctx.call({ method: op.method, path: fillPath(ctx, op.path), body: op.method === 'GET' || op.method === 'DELETE' ? undefined : {}, ...extra })

  const sweep = async (name, ops, extra, expectStatus, codes, fix, { codeIsFail = false } = {}) => {
    if (!ops.length) return
    const bad = []
    const codeWarn = []
    for (const op of ops) {
      const res = await req(op, typeof extra === 'function' ? extra(op) : extra)
      if (res.status !== expectStatus) bad.push(`${op.id} -> ${brief(res)}`)
      else if (errorProblems(res.json).length) bad.push(`${op.id} -> ${expectStatus} but ${errorProblems(res.json)[0]}`)
      else if (codes && !codes.includes(res.json.error.code)) (codeIsFail ? bad : codeWarn).push(`${op.id} -> code ${res.json.error.code}`)
    }
    if (bad.length) ctx.add({ group: 'Security', name, status: 'FAIL', detail: `${bad.length}/${ops.length} wrong: ${bad.slice(0, 5).join('; ')}`, fix })
    else if (codeWarn.length) ctx.add({ group: 'Security', name, status: 'WARN', detail: `status OK, expected code ${codes.join(' or ')}: ${codeWarn.slice(0, 4).join('; ')}`, fix: `Use error.code ${codes[0]}.` })
    else ctx.add({ group: 'Security', name, status: 'PASS', detail: `${ops.length} operation(s)` })
  }

  await sweep('No token -> 401', bearer, {}, 401, ACCEPTED_401, 'Check the Authorization header first: no token = 401 UNAUTHORIZED, before any role or body check.')
  await sweep('Garbage token -> 401', bearer, { token: 'garbage.token.value' }, 401, ACCEPTED_401, 'Reject tokens that do not verify: 401.')
  if (expired) await sweep('Expired token -> 401', bearer, { token: expired }, 401, ACCEPTED_401, 'Check exp: an expired token is 401.')
  if (ctx.mode === 'selftest') ctx.add({ group: 'Security', name: 'Token signed with another secret -> 401', status: 'SKIP', detail: 'the browser mock does not verify signatures' })
  else await sweep('Token signed with another secret -> 401', bearer, { token: wrongSecret }, 401, ACCEPTED_401, 'Verify the signature with the shared JWT_SECRET from the contract .env.example (HS256). A different secret means no token from S1 will work.')

  const explicit = bearer.filter((o) => !/any authenticated|owner/i.test(o.roles) && parseRoles(o.roles).length)
  const wrongRoleOf = (op) => ['DISPATCHER', 'MECHANIC', 'DRIVER', 'ADMIN', 'SUPPLIER', 'TOW_DRIVER'].find((r) => !parseRoles(op.roles).includes(r))
  await sweep('Wrong role -> 403 FORBIDDEN', explicit, (op) => ({ token: ctx.tokens[wrongRoleOf(op)] }), 403, ['FORBIDDEN'], 'Check the role after the token and before reading the body: wrong role = 403 FORBIDDEN (not 400 or 404).')

  const approvedOps = bearer.filter((o) => /\(approved\)/i.test(o.roles))
  const pendingToken = (op) => {
    const role = parseRoles(op.roles)[0]
    if (role === 'SUPPLIER') return { token: ctx.tokens.SUPPLIER_PENDING }
    const sub = ctx.ids.user(role === 'MECHANIC' ? ACCOUNTS.MECHANIC : ACCOUNTS.TOW_DRIVER)
    return { token: secret ? minted({ sub, role, approved: false }, secret) : undefined }
  }
  await sweep('Not approved -> 403 NOT_APPROVED', approvedOps, pendingToken, 403, ['NOT_APPROVED'], 'Read the "approved" claim of the JWT: false = 403 NOT_APPROVED (the frontend then shows the waiting screen).', { codeIsFail: true })

  await sweep('No X-Service-Key -> 401', keyed, {}, 401, null, 'Service-to-service routes need header X-Service-Key equal to SERVICE_KEY from the contract .env.example.')
  await sweep('Wrong X-Service-Key -> 401', keyed, { headers: { 'X-Service-Key': 'wrong-key' } }, 401, null, 'Compare X-Service-Key with SERVICE_KEY exactly.')
}

async function runScenario(ctx) {
  const scenario = SCENARIOS[ctx.service]
  if (!scenario) return
  const step = async (name, fn) => {
    try {
      const out = await fn()
      ctx.add({ group: 'Done when (--write)', name, status: out?.status ?? 'PASS', detail: out?.detail ?? '', fix: out?.fix })
      return out?.value
    } catch (e) {
      ctx.add({ group: 'Done when (--write)', name, status: 'FAIL', detail: e.message, fix: e.fix })
      return undefined
    }
  }
  /** Call an operation and check status + contract; throws a readable error when it does not match. */
  const expect = async (id, { path, query, token, headers, body, status, code, s1 = false } = {}) => {
    const op = ctx.op(id)
    const res = await (s1 ? ctx.callS1 : ctx.call)({ method: id.split(' ')[0], path: path ?? id.split(' ')[1], query, token, headers, body })
    const want = [].concat(status)
    if (!want.includes(res.status)) {
      const e = new Error(`${id}: expected ${want.join(' or ')}, got ${brief(res)} ${res.json?.error?.message ?? ''}`.trim())
      e.fix = code ? `Answer ${want[0]} with error.code ${code}.` : 'See the spec rules for this step.'
      throw e
    }
    if (code && res.json?.error?.code !== code) {
      const e = new Error(`${id}: status ${res.status} OK but error.code is ${res.json?.error?.code ?? 'missing'}, expected ${code}`)
      e.fix = `Use the stable code ${code}.`
      throw e
    }
    if (op) {
      const problems = responseProblems(ctx, op, res)
      if (problems.length) {
        const e = new Error(`${id}: ${problems.join('; ')}`)
        e.fix = fixFor(problems)
        throw e
      }
    }
    return res.json
  }
  await scenario(ctx, { step, expect, ACCOUNTS, bookingDate })
  ctx.add({ group: 'Done when (--write)', name: 'Re-seed afterwards', status: 'WARN', detail: 'The --write run changed demo data (orders, bookings, tows, payments).', fix: 'Run your seed command again before the demo.' })
}
