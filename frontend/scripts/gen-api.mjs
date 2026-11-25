// Generates TypeScript types from the API contract and copies the seed data.
// Usage: npm run gen:api   (reads ../contract)
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidates = [
  resolve(root, '../contract'),
]
const contract = candidates.find((p) => existsSync(join(p, 'openapi')))
if (!contract) {
  console.error('Contract folder not found. Expected ../contract/openapi')
  process.exit(1)
}
const outTypes = join(root, 'src/api/types')
const outSeed = join(root, 'src/mocks/seed')
mkdirSync(outTypes, { recursive: true })
mkdirSync(outSeed, { recursive: true })
const bin = join(root, 'node_modules/openapi-typescript/bin/cli.js')
for (const file of readdirSync(join(contract, 'openapi'))) {
  if (!file.endsWith('.yaml')) continue
  const name = file.split('-')[0] // s1, s2, ...
  execFileSync(process.execPath, [bin, join(contract, 'openapi', file), '-o', join(outTypes, `${name}.ts`)], {
    stdio: 'inherit',
  })
}
for (const file of readdirSync(join(contract, 'seed'))) {
  if (file.endsWith('.json')) copyFileSync(join(contract, 'seed', file), join(outSeed, file))
}
console.log('API types and seed data updated from', contract)
