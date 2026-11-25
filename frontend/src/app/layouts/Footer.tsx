import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

/** Figma "Section / Footer": giant wordmark on navy, disclaimer line. */
export function Footer() {
  const { t } = useTranslation()
  const year = 2026
  return (
    <footer className="relative overflow-hidden bg-[#0a1a3a] text-white">
      <div className="container-page pb-10 pt-12 sm:pt-16">
        <nav aria-label={t('footer.links')} className="mb-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
          <Link className="hover:text-white" to="/parts">{t('nav.parts')}</Link>
          <Link className="hover:text-white" to="/mechanics">{t('nav.mechanics')}</Link>
          <Link className="hover:text-white" to="/sos">{t('nav.sos')}</Link>
          <Link className="hover:text-white" to="/how-it-works">{t('nav.howItWorks')}</Link>
          <Link className="hover:text-white" to="/help">{t('nav.help')}</Link>
          <Link className="hover:text-white" to="/terms">{t('nav.terms')}</Link>
          <Link className="hover:text-white" to="/privacy">{t('nav.privacy')}</Link>
          <Link className="hover:text-white" to="/status">{t('nav.status')}</Link>
        </nav>
        <p
          dir="ltr"
          aria-hidden
          className="select-none font-sans text-[clamp(4.5rem,22vw,21rem)] font-bold leading-[0.82] tracking-[-0.06em]"
        >
          <span className="text-white">Drive</span>
          <span className="text-orange">Fix</span>
        </p>
        <p className="mt-6 max-w-2xl text-xs text-white/60">
          {t('footer.disclaimer')} © {year}
        </p>
      </div>
    </footer>
  )
}
