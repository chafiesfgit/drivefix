import i18n from '@/i18n'

function locale(): string {
  const lng = i18n.language || 'en'
  // Algerian Arabic locale, Latin digits (what people use on receipts and phones)
  if (lng.startsWith('ar')) return 'ar-DZ-u-nu-latn'
  if (lng.startsWith('fr')) return 'fr-DZ'
  return 'en-GB'
}
/** 4500 -> "4 500 DZD" (money is always an integer number of dinars; the group separator is a no-break space). */
export function formatDZD(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—'
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
    .format(Math.round(amount))
    // No-break space between digit groups keeps "3 900" one number inside Arabic (RTL) text.
    .replace(/\s/g, ' ')
  return i18n.language?.startsWith('ar') ? `${n} د.ج` : `${n} DZD`
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(locale()).format(n)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale(), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatRelative(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}

/** "0555123456" -> "+213 5 55 12 34 56" */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const p = phone.replace(/\s/g, '')
  const m = /^0([5-7])(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(p)
  if (!m) return phone
  return `+213 ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}`
}

/** Accepts 05.., 06.., 07.. or +213 / 00213 forms; returns the 0XXXXXXXXX form. */
export function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s\-.()]/g, '')
  if (p.startsWith('+213')) p = '0' + p.slice(4)
  else if (p.startsWith('00213')) p = '0' + p.slice(5)
  return p
}

export const PHONE_RE = /^0[5-7]\d{8}$/

/** Short human reference for a UUID (last 8 hex chars, so seeded ids like 0000…0301 stay distinct). */
export const shortId = (id: string) => id.replace(/-/g, '').slice(-8).toUpperCase()
