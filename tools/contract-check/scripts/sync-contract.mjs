// Only needed when this tool is copied OUTSIDE the repo: makes a local ./contract copy.
// Inside the repo the checker reads ../../contract directly, so `git pull` is enough.
// Usage: npm run sync-contract -- <path-to-contract-folder>
import { cpSync, existsSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { REPO_CONTRACT_DIR, ROOT } from '../lib/contract.mjs'

const src = resolve(process.argv[2] ?? REPO_CONTRACT_DIR)
if (!existsSync(join(src, 'openapi'))) {
  console.error(`No contract found at ${src} (it must contain openapi/ and seed/).`)
  process.exit(1)
}
const dest = join(ROOT, 'contract')
rmSync(dest, { recursive: true, force: true })
for (const item of ['openapi', 'seed', '.env.example', 'README.md', 'CHANGELOG.md']) {
  if (existsSync(join(src, item))) cpSync(join(src, item), join(dest, item), { recursive: true })
}
console.log(`Contract copied from ${src} to ${dest}`)
