import { Compass, Hammer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { PageShell } from '@/app/layouts/PageShell'
import { ButtonLink, EmptyState, Panel } from '@/design/ui'
import { useAuth } from '@/lib/auth'
import { homeFor } from '@/lib/roles'

export function AppHomeRedirect() {
  const { role, needsApproval } = useAuth()
  if (!role) return <Navigate to="/login" replace />
  return <Navigate to={needsApproval ? '/pending' : homeFor(role)} replace />
}

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-night px-4">
      <div className="text-center text-white">
        <Compass className="mx-auto mb-6 size-10 text-orange" aria-hidden />
        <p className="font-stat text-[96px] font-light leading-none tracking-tight">404</p>
        <h1 className="mt-4 font-serif text-[40px] italic text-orange-ink">{t('states.notFoundTitle')}</h1>
        <p className="mt-2 text-haze">{t('states.notFoundBody')}</p>
        <ButtonLink to="/" variant="white" arrow className="mt-8">
          {t('states.goHome')}
        </ButtonLink>
      </div>
    </div>
  )
}

/** Temporary frame for screens whose service is not plugged in yet. */
export function ComingSoon({ title }: { title: string }) {
  const { t } = useTranslation()
  return (
    <PageShell accent={title}>
      <Panel>
        <EmptyState icon={<Hammer className="size-5" aria-hidden />} title={title} description={t('states.comingSoon')} />
      </Panel>
    </PageShell>
  )
}
