import { useMutation } from '@tanstack/react-query'
import { Check, Lock, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '@/app/layouts/PageShell'
import { s1 } from '@/api'
import { cn } from '@/design/cn'
import { Button, ButtonLink } from '@/design/ui'
import { authStore, useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/errors'
import { homeFor } from '@/lib/roles'
import { AuthPanel } from './AuthPanel'

/** Supplier / mechanic / tow driver with approved=false. */
export function PendingApprovalPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { role, needsApproval, user } = useAuth()
  const [note, setNote] = useState<string | null>(null)
  const check = useMutation({
    // POST /auth/refresh swaps the old token (approved:false) for a fresh one: no sign-out needed.
    mutationFn: () => s1.refresh(),
    meta: { silent: true },
    onSuccess: (res) => {
      authStore.login(res.token, res.user)
      if (res.user.approved) {
        setNote(t('auth.approvedNow'))
        window.setTimeout(() => navigate(homeFor(res.user.role), { replace: true }), 900)
      } else setNote(t('auth.stillPending'))
    },
    onError: (e) => setNote(errorMessage(t, e)),
  })
  if (!role) return <Navigate to="/login" replace />
  if (!needsApproval) return <Navigate to={homeFor(role)} replace />
  const steps = [t('auth.pendingStep1'), t('auth.pendingStep2'), t('auth.pendingStep3'), t('auth.pendingStep4')]
  return (
    <PageShell title={t('auth.pendingTitle')} accent={t('auth.pendingAccent')} subtitle={t('auth.pendingSubtitle', { role: t(`roles.${role}`) })}>
      <AuthPanel className="max-w-[560px]">
        <p className="text-sm text-navy-600">{t('auth.pendingBody')}</p>
        <ol className="mt-6 flex flex-col gap-4">
          {steps.map((s, i) => {
            const done = i < 2
            const current = i === 2
            return (
              <li key={s} className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold',
                    done && 'border-success bg-success text-white',
                    current && 'border-orange text-orange-hover',
                    !done && !current && 'border-grey-200 text-grey-400',
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden /> : i + 1}
                </span>
                <span className={cn('text-sm', current ? 'font-semibold text-navy-900' : done ? 'text-navy-900' : 'text-navy-600')}>
                  {s}
                  {current && <span className="sr-only"> ({t('userStatus.PENDING_APPROVAL')})</span>}
                </span>
                {current && <span aria-hidden className="relative ms-1 size-2 rounded-full bg-orange"><span className="absolute inset-0 animate-pulse-ring rounded-full bg-orange" /></span>}
              </li>
            )
          })}
        </ol>
        {note && <p role="status" className="mt-5 rounded-lg bg-info-subtle px-3 py-2 text-xs text-info">{note}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button arrow loading={check.isPending} onClick={() => check.mutate()}>
            {t('auth.checkAgain')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              authStore.logout('manual')
              navigate('/login', { replace: true, state: { phone: user?.phone } })
            }}
          >
            {t('nav.logout')}
          </Button>
        </div>
      </AuthPanel>
    </PageShell>
  )
}

/** /account/locked and /account/suspended */
export function AccountStatePage() {
  const { t } = useTranslation()
  const { state } = useParams()
  const location = useLocation()
  const phone = (location.state as { phone?: string } | null)?.phone
  const locked = state !== 'suspended'
  return (
    <PageShell title={locked ? t('auth.lockedTitle') : t('auth.suspendedTitle')} accent={locked ? t('auth.lockedAccent') : t('auth.suspendedAccent')}>
      <AuthPanel>
        <div className="flex flex-col items-start gap-4">
          <span className={cn('flex size-12 items-center justify-center rounded-full', locked ? 'bg-warning-subtle text-warning' : 'bg-danger-subtle text-danger')}>
            {locked ? <Lock className="size-5" aria-hidden /> : <ShieldOff className="size-5" aria-hidden />}
          </span>
          <p className="text-sm text-navy-600">{locked ? t('auth.lockedBody') : t('auth.suspendedBody')}</p>
          <div className="flex flex-wrap gap-3">
            {locked ? (
              <ButtonLink to={`/forgot-password${phone ? `?phone=${phone}` : ''}`} arrow>
                {t('auth.resetPassword')}
              </ButtonLink>
            ) : (
              <ButtonLink to="/help" arrow>
                {t('auth.contactSupport')}
              </ButtonLink>
            )}
            <ButtonLink to="/login" variant="secondary" state={{ phone }}>
              {t('auth.backToLogin')}
            </ButtonLink>
          </div>
        </div>
      </AuthPanel>
    </PageShell>
  )
}
