// JSON checks: schema (ajv), camelCase keys, list envelope, error format.
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)
const cache = new WeakMap()

function compile(schema) {
  let fn = cache.get(schema)
  if (!fn) {
    fn = ajv.compile(schema)
    cache.set(schema, fn)
  }
  return fn
}

const hint = (e) => {
  const where = e.instancePath || '(body)'
  if (e.keyword === 'format') return `${where} must be a ${e.params.format} (got a different text)`
  if (e.keyword === 'type' && e.params.type === 'integer') return `${where} must be an integer (money is whole DZD, no decimals)`
  if (e.keyword === 'required') return `${where} is missing required field "${e.params.missingProperty}"`
  if (e.keyword === 'enum') return `${where} must be one of ${e.params.allowedValues.join(', ')}`
  return `${where} ${e.message}`
}

/** Returns a list of human-readable problems (empty = valid). */
export function schemaProblems(schema, body) {
  if (!schema) return []
  const fn = compile(schema)
  return fn(body) ? [] : fn.errors.slice(0, 6).map(hint)
}

/**
 * Field names that are not camelCase: snake_case ("delivery_fee") or PascalCase ("DeliveryFee").
 * Keys of free-form maps are data, not field names, so "sat-thu" or "16" are fine.
 */
export function badKeys(value, path = '', out = []) {
  if (Array.isArray(value)) value.slice(0, 5).forEach((v, i) => badKeys(v, `${path}[${i}]`, out))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (/_/.test(k) || /^[A-Z][a-z]/.test(k)) out.push(`${path}.${k}`.replace(/^\./, ''))
      badKeys(v, `${path}.${k}`, out)
    }
  }
  return [...new Set(out)].slice(0, 6)
}

/** True when a schema describes the shared paged list envelope. */
export function isPagedSchema(schema) {
  const p = schema?.properties
  return Boolean(p && p.items && p.page && p.pageSize && p.total)
}

export function envelopeProblems(body) {
  const missing = ['items', 'page', 'pageSize', 'total'].filter((k) => !(body && k in body))
  if (missing.length) return [`list must be { items, page, pageSize, total }: missing ${missing.join(', ')}`]
  if (!Array.isArray(body.items)) return ['"items" must be an array']
  return []
}

/** Shared error format { error: { code, message, field? } } with a stable UPPER_SNAKE code. */
export function errorProblems(body) {
  if (!body || typeof body !== 'object' || !body.error || typeof body.error !== 'object') {
    return ['error body must be { "error": { "code", "message", "field" } }']
  }
  const p = []
  if (typeof body.error.code !== 'string') p.push('error.code is missing')
  else if (!/^[A-Z][A-Z0-9_]*$/.test(body.error.code)) p.push(`error.code "${body.error.code}" must be UPPER_SNAKE`)
  if (typeof body.error.message !== 'string') p.push('error.message is missing')
  return p
}
