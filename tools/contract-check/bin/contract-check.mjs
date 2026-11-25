#!/usr/bin/env node
// Usage: node bin/contract-check.mjs --service s2 --url http://192.168.1.20:4002/api/v1 --s1 http://192.168.1.10:4001/api/v1 [--write] [--out report.md]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { SERVICES } from '../lib/contract.mjs'
import { runCheck } from '../lib/engine.mjs'
import { markdown, printLine, printSummary } from '../lib/report.mjs'

const { values } = parseArgs({
  options: {
    service: { type: 'string', short: 's' },
    url: { type: 'string', short: 'u' },
    s1: { type: 'string' },
    write: { type: 'boolean', default: false },
    out: { type: 'string', default: 'contract-check-report.md' },
    help: { type: 'boolean', short: 'h' },
  },
})

const usage = `
DriveFix contract check: does my service match the shared contract?

  node bin/contract-check.mjs --service s2 --url http://192.168.1.20:4002/api/v1 --s1 http://192.168.1.10:4001/api/v1

  --service   s1 | s2 | s3 | s4 | s5 | s6
  --url       your service base URL, ending in /api/v1 (default http://localhost:<port>/api/v1)
  --s1        S1 Identity base URL, used to log in with the seed accounts (default http://localhost:4001/api/v1)
  --write     also run the "Done when" scenario with real writes (re-seed afterwards)
  --out       report file (default contract-check-report.md)
`

if (values.help || !values.service || !SERVICES[values.service]) {
  console.log(usage)
  process.exit(values.help ? 0 : 2)
}
if (typeof fetch !== 'function') {
  console.error('Node 18 or newer is required (node --version).')
  process.exit(2)
}

const svc = values.service
const url = (values.url ?? `http://localhost:${SERVICES[svc].port}/api/v1`).replace(/\/+$/, '')
const s1Url = (values.s1 ?? 'http://localhost:4001/api/v1').replace(/\/+$/, '')

console.log(`\n  DriveFix contract check: ${SERVICES[svc].name}  (${url})${values.write ? '  [--write]' : ''}\n`)
const report = await runCheck({ service: svc, url, s1Url, write: values.write, onResult: (r) => printLine(r) })
printSummary(report)
const out = resolve(values.out)
writeFileSync(out, markdown(report), 'utf8')
console.log(`  Report: ${out}\n`)
process.exit(report.summary.FAIL ? 1 : 0)
