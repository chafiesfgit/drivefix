// Terminal table (coloured) and the markdown report teammates send back.
const COLORS = { PASS: '\x1b[32m', FAIL: '\x1b[31m', WARN: '\x1b[33m', SKIP: '\x1b[90m' }
const RESET = '\x1b[0m'
const DIM = '\x1b[2m'

export function printLine(r, color = process.stdout.isTTY) {
  const tag = color ? `${COLORS[r.status]}${r.status.padEnd(4)}${RESET}` : r.status.padEnd(4)
  let line = `  ${tag}  ${r.group.padEnd(19)} ${r.name}`
  if (r.detail) line += color ? `${DIM}  - ${r.detail}${RESET}` : `  - ${r.detail}`
  console.log(line)
  if (r.fix && r.status !== 'PASS') console.log(`        ${color ? COLORS.WARN : ''}fix:${color ? RESET : ''} ${r.fix}`)
}

export function printSummary({ summary, meta }, color = process.stdout.isTTY) {
  const c = (s, n) => (color ? `${COLORS[s]}${n} ${s}${RESET}` : `${n} ${s}`)
  console.log('')
  console.log(`  ${meta.name} at ${meta.url}: ${c('PASS', summary.PASS)}, ${c('FAIL', summary.FAIL)}, ${c('WARN', summary.WARN)}, ${c('SKIP', summary.SKIP)}`)
  console.log(summary.FAIL ? '  Not ready yet: fix every FAIL, then run again.' : '  Your service matches the contract. Send contract-check-report.md to Chafie.')
}

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')

export function markdown({ results, summary, meta }) {
  const lines = [
    `# Contract check: ${meta.name}`,
    '',
    `- Service URL: \`${meta.url}\``,
    `- S1 used for tokens: \`${meta.s1Url}\``,
    `- Contract version: ${meta.contractVersion} · write scenario: ${meta.write ? 'yes' : 'no'} · ${meta.at}`,
    `- Result: **${summary.FAIL ? 'NOT READY' : 'READY'}**: ${summary.PASS} pass, ${summary.FAIL} fail, ${summary.WARN} warn, ${summary.SKIP} skipped`,
    '',
    '| Result | Group | Check | Detail | How to fix |',
    '| --- | --- | --- | --- | --- |',
    ...results.map((r) => `| ${r.status} | ${esc(r.group)} | ${esc(r.name)} | ${esc(r.detail)} | ${r.status === 'PASS' ? '' : esc(r.fix)} |`),
    '',
  ]
  return lines.join('\n')
}
