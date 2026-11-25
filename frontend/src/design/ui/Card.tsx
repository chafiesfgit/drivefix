import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../cn'

/** White glass panel used across the app screens. */
export function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
  ...rest
}: Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title?: ReactNode
  actions?: ReactNode
  bodyClassName?: string
}) {
  return (
    <section className={cn('panel min-w-0 p-5 sm:p-6', className)} {...rest}>
      {(title || actions) && (
        <header className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-h3 font-semibold text-navy-900">{title}</h2>}
          {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-grey-200 bg-white p-5 shadow-sm', className)} {...rest} />
}

/** Big number tile (admin overview, dashboards). */
export function StatTile({ value, label, hint, className }: { value: ReactNode; label: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('panel p-5 sm:p-6', className)}>
      <p className="tabular font-stat text-[2.25rem] font-light leading-9 text-navy-900">{value}</p>
      <p className="mt-4 text-sm text-navy-600">{label}</p>
      {hint && <p className="mt-1 text-xs text-grey-400">{hint}</p>}
    </div>
  )
}

/** Label / value row (Figma: List Row). */
export function ListRow({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-grey-200/70 py-3 last:border-0', className)}>
      <span className="text-sm text-navy-600">{label}</span>
      <span className="min-w-0 break-words text-end text-sm font-medium text-navy-900">{value}</span>
    </div>
  )
}
