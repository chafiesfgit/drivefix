import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/design/cn'

/** Six boxes, numeric keyboard, paste of the full code, SMS autofill (one-time-code). Always LTR. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  invalid,
  disabled,
  length = 6,
  describedBy,
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  invalid?: boolean
  disabled?: boolean
  length?: number
  describedBy?: string
}) {
  const { t } = useTranslation()
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const setAt = (i: number, d: string) => {
    const next = (value.slice(0, i) + d + value.slice(i + 1)).slice(0, length).replace(/\D/g, '')
    onChange(next)
    if (next.length === length) onComplete?.(next)
  }

  const onKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) onChange(value.slice(0, i) + value.slice(i + 1))
      else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i))
        refs.current[i - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!text) return
    e.preventDefault()
    onChange(text)
    refs.current[Math.min(text.length, length - 1)]?.focus()
    if (text.length === length) onComplete?.(text)
  }

  return (
    <div dir="ltr" role="group" aria-label={t('auth.codeLabel')} aria-describedby={describedBy} className="flex justify-start gap-2 sm:gap-2.5">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={length}
          aria-label={t('auth.digit', { n: i + 1 })}
          aria-invalid={invalid || undefined}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={onKey(i)}
          onPaste={onPaste}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '')
            if (!raw) return
            if (raw.length > 1) {
              // SMS autofill drops the whole code into the first box
              const text = raw.slice(0, length)
              onChange(text)
              if (text.length === length) onComplete?.(text)
              refs.current[Math.min(text.length, length - 1)]?.focus()
              return
            }
            setAt(i, raw)
            if (i < length - 1) refs.current[i + 1]?.focus()
          }}
          className={cn(
            'tabular h-12 w-11 rounded-lg border bg-white text-center font-stat text-[22px] text-navy-900 outline-none transition-[border-color,box-shadow,transform] duration-150 sm:h-14 sm:w-12',
            'focus:border-brand focus:shadow-[0_0_0_3px_rgb(31_78_158/0.15)]',
            d && 'border-navy-600',
            !d && 'border-grey-200',
            invalid && 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgb(192_57_43/0.15)]',
            disabled && 'bg-sand text-grey-400',
          )}
        />
      ))}
    </div>
  )
}
