import { useTranslation } from 'react-i18next'
import { setLanguage, type AppLanguage } from '@/i18n'
import { cn } from '../cn'

const LANGS: { code: AppLanguage; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'ar', label: 'العربية' },
]

/** Figma "Lang Toggle": glass pill with a white active thumb. */
export function LangToggle({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  const { i18n, t } = useTranslation()
  const current = (i18n.resolvedLanguage ?? 'en') as AppLanguage
  return (
    <div
      role="radiogroup"
      aria-label={t('common.language')}
      className={cn(
        'inline-flex h-12 items-center rounded-full px-1.5',
        tone === 'dark' ? 'glass-pill shadow-nav' : 'border border-grey-200 bg-white',
        className,
      )}
    >
      {LANGS.map((l) => {
        const active = current === l.code
        return (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={active}
            lang={l.code}
            onClick={() => setLanguage(l.code)}
            className={cn(
              'pressable inline-flex h-9 items-center justify-center rounded-full px-3 text-xs font-semibold tracking-[0.06em] transition-colors duration-200',
              l.code === 'ar' && 'font-arabic text-[13px] tracking-normal',
              active
                ? tone === 'dark'
                  ? 'bg-white text-night'
                  : 'bg-night text-white'
                : tone === 'dark'
                  ? 'text-haze hover:text-white'
                  : 'text-navy-600 hover:text-navy-900',
            )}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}

/** Generic segmented control (filters, tabs). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; count?: number }[]
  label: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-grey-200 bg-white p-1', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'pressable inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors duration-150',
              active ? 'bg-night text-white' : 'text-navy-600 hover:bg-sand hover:text-navy-900',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn('tabular rounded-full px-1.5 text-[11px]', active ? 'bg-white/15' : 'bg-sand')}>{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
