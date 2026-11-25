import { Eye, EyeOff } from 'lucide-react'
import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'
import { controlClass } from './controlClass'

interface FieldShellProps {
  label?: ReactNode
  helper?: ReactNode
  error?: ReactNode
  required?: boolean
  className?: string
  /** dark = on navy backgrounds (hero search panel) */
  tone?: 'light' | 'dark'
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

export function FieldShell({ label, helper, error, required, className, tone = 'light', children }: FieldShellProps) {
  const id = useId()
  const helpId = `${id}-help`
  const invalid = Boolean(error)
  const describedBy = error || helper ? helpId : undefined
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      {label && (
        <label
          htmlFor={id}
          className={cn('text-sm font-medium', tone === 'dark' ? 'text-white/90' : 'text-navy-900')}
        >
          {label}
          {required && (
            <span aria-hidden className="ms-0.5 text-orange">
              *
            </span>
          )}
        </label>
      )}
      {children({ id, describedBy, invalid })}
      {(error || helper) && (
        <p
          id={helpId}
          role={error ? 'alert' : undefined}
          className={cn(
            'text-xs',
            error ? (tone === 'dark' ? 'text-[#ffb4a8]' : 'text-danger') : tone === 'dark' ? 'text-white/55' : 'text-navy-600',
          )}
        >
          {error || helper}
        </p>
      )}
    </div>
  )
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> & {
  label?: ReactNode
  helper?: ReactNode
  error?: ReactNode
  tone?: 'light' | 'dark'
  containerClassName?: string
  leading?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, tone = 'light', containerClassName, className, required, leading, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} helper={helper} error={error} required={required} tone={tone} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {leading && (
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-navy-600">
              {leading}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            required={required}
            className={cn(controlClass(invalid, tone), leading && 'ps-9', className)}
            {...rest}
          />
        </div>
      )}
    </FieldShell>
  )
})

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(function PasswordInput(
  { label, helper, error, tone = 'light', containerClassName, className, required, ...rest },
  ref,
) {
  const [show, setShow] = useState(false)
  const { t } = useTranslation()
  return (
    <FieldShell label={label} helper={helper} error={error} required={required} tone={tone} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={show ? 'text' : 'password'}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            required={required}
            className={cn(controlClass(invalid, tone), 'pe-10', className)}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t('common.hidePassword') : t('common.showPassword')}
            aria-pressed={show}
            className="absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-md text-navy-600 hover:text-navy-900"
          >
            {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      )}
    </FieldShell>
  )
})

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label?: ReactNode
  helper?: ReactNode
  error?: ReactNode
  tone?: 'light' | 'dark'
  containerClassName?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helper, error, tone = 'light', containerClassName, className, required, options, placeholder, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} helper={helper} error={error} required={required} tone={tone} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <select
          ref={ref}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          className={cn(
            controlClass(invalid, tone),
            'appearance-none bg-[length:16px] bg-no-repeat pe-9',
            'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2355627A%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E")]',
            'bg-[position:right_12px_center] rtl:bg-[position:left_12px_center]',
            className,
          )}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  )
})

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> & {
  label?: ReactNode
  helper?: ReactNode
  error?: ReactNode
  containerClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helper, error, containerClassName, className, required, rows = 3, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} helper={helper} error={error} required={required} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          className={cn(controlClass(invalid), 'h-auto resize-y py-2', className)}
          {...rest}
        />
      )}
    </FieldShell>
  )
})

/** Accessible checkbox with label. */
export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; error?: ReactNode }
>(function Checkbox({ label, error, className, ...rest }, ref) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="inline-flex cursor-pointer items-start gap-2.5 text-sm text-navy-900">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 cursor-pointer rounded-sm border-grey-200 accent-orange"
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
})
