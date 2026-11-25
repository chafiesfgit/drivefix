// Fails when an error code used by the contract has no errors.<CODE> translation in en, fr or ar.
// Sources: README "Stable error codes", the response descriptions/examples of every OpenAPI file, CHANGELOG.
// Usage: npm run check:errors
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contract = join(root, '..', 'contract')
if (!existsSync(contract)) {
  console.error(`Contract not found at ${contract}`)
  process.exit(1)
}
const CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/
const codes = new Map() // code -> where it was found

const readme = readFileSync(join(contract, 'README.md'), 'utf8')
const section = readme.split(/^## Stable error codes.*$/m)[1]?.split(/^## /m)[0] ?? ''
for (const w of section.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) ?? []) codes.set(w, 'README')

for (const f of readdirSync(join(contract, 'openapi')).filter((x) => x.endsWith('.yaml'))) {
  const text = readFileSync(join(contract, 'openapi', f), 'utf8')
  // response descriptions start with the stable code: "FORBIDDEN (stable error.code...)", "ACCOUNT_SUSPENDED"
  for (const m of text.matchAll(/^ {10}description: '?([A-Z][A-Z0-9_]{3,})\b/gm)) if (CODE.test(m[1])) codes.set(m[1], f)
  for (const m of text.matchAll(/^ {14}example: ([A-Z][A-Z0-9_]{3,})\s*$/gm)) codes.set(m[1], f)
}
const changelog = join(contract, 'CHANGELOG.md')
if (existsSync(changelog)) {
  for (const line of readFileSync(changelog, 'utf8').split('\n').filter((l) => /error code/i.test(l))) {
    for (const m of line.matchAll(/`([A-Z][A-Z0-9_]{3,})`/g)) codes.set(m[1], 'CHANGELOG')
  }
}

let missing = 0
for (const lang of ['en', 'fr', 'ar']) {
  const errors = JSON.parse(readFileSync(join(root, 'src', 'i18n', `${lang}.json`), 'utf8')).errors ?? {}
  const gaps = [...codes.keys()].filter((c) => !errors[c])
  missing += gaps.length
  console.log(`${lang}: ${gaps.length ? `MISSING ${gaps.map((c) => `${c} (${codes.get(c)})`).join(', ')}` : 'ok'}`)
}
console.log(`${codes.size} contract error codes checked: ${[...codes.keys()].sort().join(", ")}`)
process.exit(missing ? 1 : 0)
