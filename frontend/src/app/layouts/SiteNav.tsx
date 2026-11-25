import { Menu } from 'lucide-react'
import { useState, type MouseEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router-dom'
import { cn } from '@/design/cn'
import { ButtonLink, LangToggle, Logo } from '@/design/ui'
import { Drawer } from '@/design/ui/Drawer'
import { useAuth } from '@/lib/auth'
import { homeFor } from '@/lib/roles'

export interface SiteLink {
  label: string
  to: string
  /** For in-page anchors on the landing page */
  active?: boolean
  onClick?: (e: MouseEvent) => void
}

/**
 * Figma "Landing Nav (floating)": logo left, glass pill link group centre,
 * EN|FR|AR toggle, orange "Get started" pill on the right edge of the 64px page margin.
 */
export function SiteNav({ links, condensed = false, anchors = false, extra }: { links: SiteLink[]; condensed?: boolean; anchors?: boolean; extra?: ReactNode }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { isAuthenticated, role } = useAuth()
  const cta = isAuthenticated && role ? { to: homeFor(role), label: t('nav.myAccount') } : { to: '/register', label: t('nav.getStarted') }

  return (
    <>
      <div
        className={cn(
          'mx-auto flex w-full max-w-page items-center justify-between gap-3 px-[var(--page-gutter)] transition-[padding] duration-300 ease-out',
          condensed ? 'py-2' : 'py-5',
        )}
      >
        <div className="shrink-0 ps-1">
          <Logo mode="dark" />
        </div>

        <nav aria-label={t('nav.main')} className="hidden lg:block">
          <ul className="glass-pill flex h-12 items-center gap-1 rounded-full px-2.5 shadow-nav">
            {links.map((l) => (
              <li key={l.to}>
                {anchors ? (
                  <a
                    href={l.to}
                    onClick={l.onClick}
                    aria-current={l.active ? 'true' : undefined}
                    className={cn(
                      'relative block px-3.5 py-3 text-sm font-medium transition-colors duration-200',
                      l.active ? 'text-white' : 'text-white/[0.66] hover:text-white',
                    )}
                  >
                    {l.label}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-x-3.5 bottom-1.5 h-0.5 origin-center rounded-sm bg-orange shadow-[0_0_12px_rgb(242_106_27/0.9)] transition-[transform,opacity] duration-300 ease-out',
                        l.active ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0',
                      )}
                    />
                  </a>
                ) : (
                  <NavLink
                    to={l.to}
                    className={({ isActive }) =>
                      cn(
                        'group relative block px-3.5 py-3 text-sm font-medium transition-colors duration-200',
                        isActive ? 'text-white' : 'text-white/[0.66] hover:text-white',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {l.label}
                        <span
                          aria-hidden
                          className={cn(
                            'absolute inset-x-3.5 bottom-1.5 h-0.5 rounded-sm bg-orange shadow-[0_0_12px_rgb(242_106_27/0.9)] transition-[transform,opacity] duration-300 ease-out',
                            isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0',
                          )}
                        />
                      </>
                    )}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center lg:flex">
          <LangToggle />
        </div>

        <div className="flex items-center gap-2">
          {extra}
          {!isAuthenticated && (
            <Link to="/login" className="hidden rounded-full px-3 py-2 text-sm font-medium text-white/80 hover:text-white sm:inline-block lg:hidden xl:inline-block">
              {t('nav.signIn')}
            </Link>
          )}
          <ButtonLink to={cta.to} variant="accent" arrow className="hidden sm:inline-flex">
            {cta.label}
          </ButtonLink>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('nav.openMenu')}
            className="pressable glass-pill inline-flex size-11 items-center justify-center rounded-full text-white lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title={t('nav.menu')}>
        <ul className="flex flex-col gap-1">
          {links.map((l) => (
            <li key={l.to}>
              {anchors ? (
                <a
                  href={l.to}
                  onClick={(e) => {
                    l.onClick?.(e)
                    setOpen(false)
                  }}
                  className="block rounded-xl px-4 py-3 text-body font-medium text-white/85 hover:bg-white/10"
                >
                  {l.label}
                </a>
              ) : (
                <NavLink
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => cn('block rounded-xl px-4 py-3 text-body font-medium hover:bg-white/10', isActive ? 'bg-white/10 text-white' : 'text-white/85')}
                >
                  {l.label}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-3 px-2">
          <LangToggle className="self-start" />
          {!isAuthenticated && (
            <ButtonLink to="/login" variant="glass" fullWidth onClick={() => setOpen(false)}>
              {t('nav.signIn')}
            </ButtonLink>
          )}
          <ButtonLink to={cta.to} variant="accent" arrow fullWidth onClick={() => setOpen(false)}>
            {cta.label}
          </ButtonLink>
        </div>
      </Drawer>
    </>
  )
}
