// Merges scripts/i18n/*.json catalogues ({ en, fr, ar }) into src/i18n/{lang}.json (deep merge, catalogue wins).
// Usage: node scripts/i18n/merge.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '../../src/i18n')
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const merge = (a, b) => {
  for (const [k, v] of Object.entries(b)) a[k] = isObj(v) && isObj(a[k]) ? merge(a[k], v) : v
  return a
}
for (const lang of ['en', 'fr', 'ar']) {
  const file = join(out, `${lang}.json`)
  let data = JSON.parse(readFileSync(file, 'utf8'))
  for (const f of readdirSync(here).filter((x) => x.endsWith('.json')).sort()) {
    const cat = JSON.parse(readFileSync(join(here, f), 'utf8'))
    if (cat[lang]) data = merge(data, cat[lang])
  }
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}
// Report keys missing in fr/ar compared to en
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (isObj(v) ? flat(v, `${p}${k}.`) : [`${p}${k}`]))
const en = new Set(flat(JSON.parse(readFileSync(join(out, 'en.json'), 'utf8'))))
for (const lang of ['fr', 'ar']) {
  const keys = new Set(flat(JSON.parse(readFileSync(join(out, `${lang}.json`), 'utf8'))))
  const missing = [...en].filter((k) => !keys.has(k) && !k.endsWith('_one') && !k.endsWith('_other'))
  if (missing.length) console.log(`${lang} missing:`, missing.join(', '))
}
console.log('i18n merged')
