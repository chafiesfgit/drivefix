import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { PageShell } from '@/app/layouts/PageShell'
import { s1 } from '@/api'
import { isApiError } from '@/api/http'
import type { AuthResult } from '@/api/s1'
import { Button, ButtonLink, useToast } from '@/design/ui'
import { authStore } from '@/lib/auth'
import { isMocked } from '@/lib/env'
import { errorMessage } from '@/lib/errors'
import { formatPhone } from '@/lib/format'
import { homeFor } from '@/lib/roles'
import { OtpInput } from './OtpInput'
import { AuthPanel } from './AuthPanel'
import { pendingSignup } from './shared'

const RESEND_S = 60
const MAX_ATTEMPTS = 5

function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    if (left <= 0) return
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [left])
  return { left, restart: () => setLeft(seconds) }
}

function Result({ result }: { result: AuthResult }) {
  const { t } = useTranslation()
  const driver = result.user.role === 'DRIVER'
  return (
    <AuthPanel>
      <div className="flex flex-col items-start gap-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
          {driver ? <CheckCircle2 className="size-6" aria-hidden /> : <Clock className="size-6" aria-hidden />}
        </span>
        <h2 className="text-h2 font-semibold text-navy-900">{t('auth.verifiedTitle')}</h2>
        <p className="text-sm text-navy-600">{driver ? t('auth.verifiedDriver') : t('auth.verifiedPro')}</p>
        <ButtonLink to={driver ? homeFor('DRIVER') : '/pending'} arrow replace>
          {t('auth.goDashboard')}
        </ButtonLink>
      </div>
    </AuthPanel>
  )
}

export function VerifyOtpPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const location = useLocation()
  const saved = pendingSignup.load()
  const phone = (location.state as { phone?: string } | null)?.phone ?? saved?.phone
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(0)
  const [locked, setLocked] = useState(false)
  const [result, setResult] = useState<AuthResult | null>(null)
  const { left, restart } = useCountdown(RESEND_S)

  const verify = useMutation({
    mutationFn: (c: string) => s1.verifyOtp(phone!, c),
    meta: { silent: true },
    onSuccess: (res) => {
      pendingSignup.clear()
      authStore.login(res.token, res.user)
      setResult(res)
    },
    onError: (e) => {
      setCode('')
      if (!isApiError(e)) return
      if (e.code === 'OTP_INVALID') setWrong((w) => w + 1)
      if (e.code === 'OTP_ATTEMPTS_EXCEEDED' || e.code === 'OTP_EXPIRED') setLocked(true)
    },
  })

  const resend = useMutation({
    mutationFn: () => s1.resendOtp(phone!),
    meta: { silent: true },
    onSuccess: () => {
      toast.info(t('auth.resent'))
      restart()
      setWrong(0)
      setLocked(false)
      verify.reset()
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  })

  if (!phone) return <Navigate to="/register" replace />

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - wrong)
  const error = verify.error ? errorMessage(t, verify.error) : null
  const disabled = locked || attemptsLeft === 0 || verify.isPending

  return (
    <PageShell title={t('auth.verifyTitle')} accent={t('auth.verifyAccent')} subtitle={t('auth.verifySubtitle', { phone: formatPhone(phone) })}>
      {result ? (
        <Result result={result} />
      ) : (
        <AuthPanel title={t('auth.codeLabel')} className="max-w-[480px]">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (code.length === 6) verify.mutate(code)
            }}
            className="flex flex-col gap-4"
          >
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={(c) => !disabled && verify.mutate(c)}
              invalid={Boolean(error)}
              disabled={disabled}
              describedBy="otp-help"
            />
            <div id="otp-help" className="flex flex-col gap-1 text-xs">
              {error ? (
                <p role="alert" className="text-danger">
                  {error}
                  {wrong > 0 && !locked && attemptsLeft > 0 && ` · ${t('auth.attemptsLeftOtp', { count: attemptsLeft })}`}
                </p>
              ) : (
                <p className="text-navy-600">{isMocked('s1') ? t('auth.mockOtpHint') : t('auth.devOtpHint')}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" arrow loading={verify.isPending} disabled={code.length !== 6 || disabled}>
                {t('auth.verify')}
              </Button>
              <Button variant="secondary" arrow disabled={left > 0 || resend.isPending} loading={resend.isPending} onClick={() => resend.mutate()}>
                {left > 0 ? <span className="tabular">{t('auth.resendIn', { s: left })}</span> : t('auth.resend')}
              </Button>
            </div>
            <p className="border-t border-grey-200 pt-4 text-sm text-navy-600">
              {t('auth.wrongNumber')}{' '}
              <Link to="/register" className="font-medium text-brand hover:underline">
                {t('auth.startAgain')}
              </Link>
            </p>
          </form>
        </AuthPanel>
      )}
    </PageShell>
  )
}
