import type { ReactNode } from 'react'
import { cn } from '@/design/cn'

/** Narrow glass panel used by every auth screen (Figma 77 Register, 12 Sign in…). */
export function AuthPanel({ title, description, children, className }: { title?: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('panel w-full max-w-[440px] p-5 sm:p-6', className)}>
      {title && <h2 className="text-h3 font-semibold text-navy-900">{title}</h2>}
      {description && <p className="mt-2 text-xs leading-5 text-navy-600">{description}</p>}
      <div className={cn(title || description ? 'mt-5' : '')}>{children}</div>
    </section>
  )
}
