import { Mail, MessageCircle, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageShell } from '@/app/layouts/PageShell'
import { ButtonLink, Panel } from '@/design/ui'
import { MechanicsBrowser } from '@/features/mechanics/MechanicsBrowser'
import { PartsBrowser } from '@/features/parts/PartsBrowser'
import { HOTLINE, SosForm } from '@/features/towing/SosForm'

export { MechanicProfilePage } from '@/features/mechanics/MechanicProfile'
export { TrackPage } from '@/features/towing/SosTracking'

export function PartsCatalogPage() {
  const { t } = useTranslation()
  return (
    <PageShell title={t('parts.title')} accent={t('parts.accent')} subtitle={t('parts.guestSubtitle')}>
      <PartsBrowser basePath="/parts" />
    </PageShell>
  )
}

export function MechanicsDirectoryPage() {
  const { t } = useTranslation()
  return (
    <PageShell title={t('mechanics.title')} accent={t('mechanics.accent')} subtitle={t('mechanics.subtitle')}>
      <MechanicsBrowser basePath="/mechanics" />
    </PageShell>
  )
}

export function SosGuestPage() {
  const { t } = useTranslation()
  return (
    <PageShell title={t('sos.title')} accent={t('sos.accent')} subtitle={t('sos.guestSubtitle')}>
      <SosForm />
    </PageShell>
  )
}

export function HowItWorksPage() {
  const { t } = useTranslation()
  const blocks = [
    { title: t('nav.parts'), steps: [t('how.parts1'), t('how.parts2'), t('how.parts3')], to: '/parts' },
    { title: t('nav.mechanics'), steps: [t('how.mech1'), t('how.mech2'), t('how.mech3')], to: '/mechanics' },
    { title: t('nav.sos'), steps: [t('how.sos1'), t('how.sos2'), t('how.sos3')], to: '/sos' },
  ]
  return (
    <PageShell title={t('how.title')} accent={t('how.accent')} subtitle={t('how.subtitle')}>
      <div className="grid gap-5 md:grid-cols-3">
        {blocks.map((b) => (
          <Panel key={b.to} title={b.title}>
            <ol className="flex flex-col gap-3">
              {b.steps.map((s, i) => (
                <li key={s} className="flex gap-3 text-sm text-navy-900">
                  <span className="font-stat text-xl font-light text-orange-hover">0{i + 1}</span>
                  <span className="pt-1">{s}</span>
                </li>
              ))}
            </ol>
            <ButtonLink to={b.to} variant="secondary" arrow className="mt-5">
              {t('landing.explore')}
            </ButtonLink>
          </Panel>
        ))}
      </div>
    </PageShell>
  )
}

export function HelpPage() {
  const { t } = useTranslation()
  return (
    <PageShell title={t('help.title')} accent={t('help.accent')} subtitle={t('help.subtitle')}>
      <div className="grid gap-5 md:grid-cols-3">
        <Panel title={t('help.call')}>
          <p className="text-sm text-navy-600">{t('help.callBody')}</p>
          <a href={`tel:${HOTLINE.replace(/\s/g, '')}`} className="mt-4 inline-flex items-center gap-2 font-semibold text-brand">
            <Phone className="size-4" aria-hidden />
            <span dir="ltr">{HOTLINE}</span>
          </a>
        </Panel>
        <Panel title={t('help.email')}>
          <p className="text-sm text-navy-600">{t('help.emailBody')}</p>
          <a href="mailto:support@drivefix.dz" className="mt-4 inline-flex items-center gap-2 font-semibold text-brand">
            <Mail className="size-4" aria-hidden />
            support@drivefix.dz
          </a>
        </Panel>
        <Panel title={t('help.faq')}>
          <p className="text-sm text-navy-600">{t('help.faqBody')}</p>
          <ButtonLink to="/#faq" variant="secondary" arrow className="mt-4" icon={<MessageCircle className="size-4" aria-hidden />}>
            {t('nav.faq')}
          </ButtonLink>
        </Panel>
      </div>
    </PageShell>
  )
}

function LegalPage({ k }: { k: 'terms' | 'privacy' }) {
  const { t } = useTranslation()
  const sections = t(`legal.${k}.sections`, { returnObjects: true }) as { h: string; p: string }[]
  return (
    <PageShell title={t(`legal.${k}.title`)} accent={t(`legal.${k}.accent`)} subtitle={t('legal.updated')}>
      <Panel className="max-w-3xl">
        <div className="flex flex-col gap-6">
          {Array.isArray(sections) &&
            sections.map((s) => (
              <section key={s.h}>
                <h2 className="text-h3 font-semibold text-navy-900">{s.h}</h2>
                <p className="mt-2 text-sm leading-6 text-navy-600">{s.p}</p>
              </section>
            ))}
        </div>
      </Panel>
    </PageShell>
  )
}

export function TermsPage() {
  return <LegalPage k="terms" />
}

export function PrivacyPage() {
  return <LegalPage k="privacy" />
}
