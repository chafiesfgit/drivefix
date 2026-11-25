import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'orange'

const TONE: Record<Tone, { box: string; dot: string }> = {
  success: { box: 'bg-success-subtle text-success', dot: 'bg-success' },
  danger: { box: 'bg-danger-subtle text-danger', dot: 'bg-danger' },
  warning: { box: 'bg-warning-subtle text-warning', dot: 'bg-warning' },
  info: { box: 'bg-info-subtle text-info', dot: 'bg-info' },
  neutral: { box: 'bg-sand text-navy-600', dot: 'bg-navy-600' },
  orange: { box: 'bg-orange/10 text-orange-hover', dot: 'bg-orange' },
}

/** Status is always label + colour, never colour alone (Figma: Status Chip). */
export function StatusChip({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
        TONE[tone].box,
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', TONE[tone].dot)} />
      <span className="truncate">{children}</span>
    </span>
  )
}

/** Small outline tag (e.g. "Used", "Tested", "Parts"). */
export function Tag({ children, tone = 'light', className }: { children: ReactNode; tone?: 'light' | 'dark'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tone === 'dark' ? 'border-white/30 text-white/90' : 'border-grey-200 bg-white text-navy-900',
        className,
      )}
    >
      {children}
    </span>
  )
}

export type TrustState = 'verified' | 'pending' | 'unverified'

/** Figma: Trust Badge (Verified / Pending / Not verified). */
export function TrustBadge({ state, label, className }: { state: TrustState; label?: string; className?: string }) {
  const { t } = useTranslation()
  const map = {
    verified: { Icon: ShieldCheck, cls: 'bg-success-subtle text-success', text: t('trust.verified') },
    pending: { Icon: ShieldQuestion, cls: 'bg-warning-subtle text-warning', text: t('trust.pending') },
    unverified: { Icon: ShieldAlert, cls: 'bg-sand text-navy-600', text: t('trust.unverified') },
  }[state]
  const { Icon } = map
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', map.cls, className)}>
      <Icon className="size-3.5" aria-hidden />
      {label ?? map.text}
    </span>
  )
}

/** Eyebrow pill used above section titles ("HOW IT WORKS"). */
export function Eyebrow({ children, tone = 'light', className }: { children: ReactNode; tone?: 'light' | 'dark'; className?: string }) {
  return (
    <span
      className={cn(
        'eyebrow inline-flex items-center gap-1.5 rounded-full border px-3 py-1',
        tone === 'dark'
          ? 'border-orange/60 bg-orange/[0.22] text-orange-soft'
          : 'border-orange/40 bg-white/60 text-orange-hover',
        className,
      )}
    >
      <span aria-hidden className="size-1 rounded-full bg-current" />
      {children}
    </span>
  )
}
