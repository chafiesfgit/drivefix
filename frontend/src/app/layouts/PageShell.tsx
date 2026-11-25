import type { ReactNode } from 'react'
import { cn } from '@/design/cn'
import { HeaderBand, PageHeader } from '@/design/ui'

/** Height reserved for the floating nav that sits on top of the header band. */
export const NAV_H = 88

/**
 * Standard page frame from Figma: navy header band (218px + nav), title on the band,
 * first panel overlapping the band edge, 1200px container.
 */
export function PageShell({
  title,
  accent,
  subtitle,
  actions,
  children,
  className,
  wide,
}: {
  title?: string
  accent?: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  wide?: boolean
}) {
  return (
    <div className="relative">
      <HeaderBand height={NAV_H + 218} />
      <div className={cn('container-page relative pb-16', wide && 'max-w-[calc(1320px+var(--page-gutter)*2)]')} style={{ paddingTop: NAV_H + 40 }}>
        <PageHeader title={title} accent={accent} subtitle={subtitle} actions={actions} />
        <div className={cn('mt-6', className)}>{children}</div>
      </div>
    </div>
  )
}
