import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import logoDark from '@/assets/figma/logo-icon-dark.svg'
import logoLight from '@/assets/figma/logo-icon-light.svg'
import { cn } from '../cn'

/** Figma "Logo / Horizontal": icon + "Drive" + orange "Fix" (ExtraBold Italic). */
export function Logo({
  mode = 'dark',
  size = 'md',
  className,
  to = '/',
}: {
  mode?: 'dark' | 'light'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  to?: string | null
}) {
  const dims = size === 'sm' ? { w: 28, h: 20, text: 'text-[17px]' } : size === 'lg' ? { w: 48, h: 34, text: 'text-[28px]' } : { w: 34, h: 24, text: 'text-[20px]' }
  const content = (
    <span dir="ltr" className={cn('inline-flex items-center gap-1', className)}>
      <img src={mode === 'dark' ? logoDark : logoLight} alt="" width={dims.w} height={dims.h} style={{ width: dims.w, height: dims.h }} />
      <span className={cn('font-sans font-extrabold italic leading-none tracking-[-0.03em]', dims.text)}>
        <span className={mode === 'dark' ? 'text-white' : 'text-ink'}>Drive</span>
        <span className="text-[#f28c28]">Fix</span>
      </span>
    </span>
  )
  if (to === null) return content
  return (
    <Link to={to} aria-label="DriveFix" className="inline-flex rounded-md">
      {content}
    </Link>
  )
}

/**
 * Figma "Header band": navy band with orange glow and thin arc behind app page titles.
 * Drawn in CSS so it stretches correctly at every width.
 */
export function HeaderBand({ className, height = 218 }: { className?: string; height?: number }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 overflow-hidden bg-night', className)} style={{ height }}>
      <div
        className="absolute left-1/2 top-[70px] h-[640px] w-[min(1300px,140vw)] -translate-x-1/2 rounded-[50%]"
        style={{
          // Figma: radial gradient scaled to 2x the ellipse, so the dome keeps a soft but visible edge
          background:
            'radial-gradient(100% 100% at 50% 50%, rgb(242 106 27 / 0.85), rgb(242 106 27 / 0.3) 45%, rgb(11 42 91 / 0) 75%)',
        }}
      />
      <div className="absolute left-1/2 top-[98px] size-[1400px] -translate-x-1/2 rounded-full border border-[#ffbe8c]/40" />
    </div>
  )
}

/**
 * Page title on the header band. Figma uses two styles:
 * - guest pages: light white words + orange Newsreader italic accent ("Spare *parts*")
 * - app pages: the whole title in orange Newsreader italic ("*Approvals*")
 */
export function PageHeader({
  title,
  accent,
  subtitle,
  actions,
}: {
  title?: string
  accent?: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="break-words text-[2.5rem] font-light leading-[1.12] tracking-[-0.035em] text-white sm:text-[52px]">
          {title}
          {title && accent && ' '}
          {accent && <span className="font-serif italic text-orange">{accent}</span>}
        </h1>
        {subtitle && <p className="mt-1 text-body text-haze">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
