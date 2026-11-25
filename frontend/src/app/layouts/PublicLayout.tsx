import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { Footer } from './Footer'
import { SiteNav } from './SiteNav'

export function SkipLink() {
  const { t } = useTranslation()
  return (
    <a
      href="#main"
      className="fixed start-4 top-4 z-[200] -translate-y-24 rounded-full bg-white px-4 py-2 text-sm font-medium text-navy-900 shadow-panel transition-transform focus:translate-y-0"
    >
      {t('common.skipToContent')}
    </a>
  )
}

/** Guest pages: floating glass nav over the navy header band, footer. */
export function PublicLayout() {
  const { t } = useTranslation()
  const links = [
    { label: t('nav.parts'), to: '/parts' },
    { label: t('nav.mechanics'), to: '/mechanics' },
    { label: t('nav.sos'), to: '/sos' },
    { label: t('nav.howItWorks'), to: '/how-it-works' },
  ]
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="absolute inset-x-0 top-0 z-30">
        <SiteNav links={links} />
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
