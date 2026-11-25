import { LogOut, Menu, User } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { cn } from '@/design/cn'
import { LangToggle, Logo, Popover } from '@/design/ui'
import { Drawer } from '@/design/ui/Drawer'
import { NotificationBell } from '@/features/notifications/Bell'
import { authStore, useAuth } from '@/lib/auth'
import { ROLE_NAV } from '@/lib/nav'
import { homeFor, type Role } from '@/lib/roles'
import { SkipLink } from './PublicLayout'

function initials(name?: string) {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

const NOTIF_PATH: Record<Role, string> = {
  DRIVER: '/app/driver/notifications',
  SUPPLIER: '/app/supplier/notifications',
  MECHANIC: '/app/mechanic/notifications',
  TOW_DRIVER: '/app/tow/notifications',
  DISPATCHER: '/app/dispatcher/notifications',
  ADMIN: '/app/admin/notifications',
}

/** Logged-in shell: same floating glass nav as the landing, with the role's pages. */
export function RoleLayout() {
  const { t } = useTranslation()
  const { role, user } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  if (!role) return null
  const items = ROLE_NAV[role]
  const logout = () => {
    authStore.logout('manual')
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex w-full max-w-page items-center justify-between gap-3 px-[var(--page-gutter)] py-5">
          <div className="shrink-0 ps-1">
            <Logo mode="dark" to={homeFor(role)} />
          </div>

          <nav aria-label={t('nav.main')} className="hidden min-w-0 xl:block">
            <ul className="glass-pill no-scrollbar flex h-12 max-w-[min(940px,calc(100vw-380px))] items-center gap-0.5 overflow-x-auto rounded-full px-2 shadow-nav">
              {/* "Profile" lives in the account menu: keeping it out of the bar leaves room for the work screens */}
              {items.filter((item) => item.label !== 'profile').map((item) => (
                <li key={item.to} className="shrink-0">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'relative block whitespace-nowrap px-2.5 py-3 text-sm font-medium transition-colors duration-200 2xl:px-3',
                        isActive ? 'text-white' : 'text-white/[0.66] hover:text-white',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {t(`nav.${item.label}`)}
                        <span
                          aria-hidden
                          className={cn(
                            'absolute inset-x-3 bottom-1.5 h-0.5 rounded-sm bg-orange shadow-[0_0_12px_rgb(242_106_27/0.9)] transition-[transform,opacity] duration-300 ease-out',
                            isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0',
                          )}
                        />
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5">
            <div className="glass-pill flex h-12 items-center gap-0.5 rounded-full px-1 shadow-nav">
              <NotificationBell allHref={NOTIF_PATH[role]} />
              <Popover
                label={t('nav.account')}
                className="w-64"
                trigger={({ open: o, toggle, id }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-haspopup="dialog"
                    aria-expanded={o}
                    aria-controls={id}
                    aria-label={t('nav.account')}
                    className="pressable inline-flex size-10 items-center justify-center rounded-full bg-white text-xs font-semibold text-night"
                  >
                    {initials(user?.fullName)}
                  </button>
                )}
              >
                {(close) => (
                  <div className="p-2">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-semibold text-navy-900">{user?.fullName ?? '—'}</p>
                      <p className="text-xs text-navy-600">{t(`roles.${role}`)}</p>
                    </div>
                    <div className="px-3 py-2">
                      <LangToggle tone="light" className="h-10" />
                    </div>
                    <Link
                      to={items.find((i) => i.to.endsWith('/profile'))?.to ?? homeFor(role)}
                      onClick={close}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-navy-900 hover:bg-sand"
                    >
                      <User className="size-4" aria-hidden />
                      {t('nav.profile')}
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm text-danger hover:bg-danger-subtle"
                    >
                      <LogOut className="flip-rtl size-4" aria-hidden />
                      {t('nav.logout')}
                    </button>
                  </div>
                )}
              </Popover>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t('nav.openMenu')}
              className="pressable glass-pill inline-flex size-12 items-center justify-center rounded-full text-white xl:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <Drawer open={open} onClose={() => setOpen(false)} title={t(`roles.${role}`)}>
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-body font-medium hover:bg-white/10',
                    isActive ? 'bg-white/10 text-white' : 'text-white/80',
                  )
                }
              >
                <item.icon className="size-[18px]" aria-hidden />
                {t(`nav.${item.label}`)}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-3 px-2">
          <LangToggle className="self-start" />
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-start text-body font-medium text-[#ffb4a8] hover:bg-white/10"
          >
            <LogOut className="flip-rtl size-[18px]" aria-hidden />
            {t('nav.logout')}
          </button>
        </div>
      </Drawer>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
    </div>
  )
}
