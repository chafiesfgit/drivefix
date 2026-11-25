import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { PageShell } from '@/app/layouts/PageShell'
import { s1 } from '@/api'
import { isApiError } from '@/api/http'
import { Button, Input, PasswordInput } from '@/design/ui'
import { setLanguage, type AppLanguage } from '@/i18n'
import { authStore } from '@/lib/auth'
import { decodeJwt } from '@/lib/jwt'
import { errorMessage } from '@/lib/errors'
import { NEEDS_APPROVAL, homeFor } from '@/lib/roles'
import { AuthPanel } from './AuthPanel'
import { passwordSchema, pendingSignup, phoneSchema, tr } from './shared'

const schema = z.object({ phone: phoneSchema, password: passwordSchema })
type Form = z.input<typeof schema>

const DEMO = [
  { phone: '0555000001', role: 'ADMIN' },
  { phone: '0555000002', role: 'DRIVER' },
  { phone: '0555000004', role: 'SUPPLIER' },
  { phone: '0555000011', role: 'SUPPLIER', pending: true },
  { phone: '0555000006', role: 'MECHANIC' },
  { phone: '0555000008', role: 'TOW_DRIVER' },
  { phone: '0555000010', role: 'DISPATCHER' },
]

/** Client-side count of wrong passwords per phone, to warn before the 15-minute lock. */
const failures = new Map<string, number>()

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string; phone?: string; message?: string } | null) ?? {}
  const [warning, setWarning] = useState<string | null>(from.message ?? null)
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { phone: from.phone ?? '', password: '' } })

  const login = useMutation({
    mutationFn: (v: z.output<typeof schema>) => s1.login(v.phone, v.password),
    meta: { silent: true },
    onSuccess: (res, v) => {
      failures.delete(v.phone)
      authStore.login(res.token, res.user)
      // Use the account's language unless this browser already has an explicit choice
      let saved: string | null = null
      try {
        saved = localStorage.getItem('df.lang')
      } catch {
        saved = null
      }
      if (!saved && res.user.language && res.user.language !== document.documentElement.lang) setLanguage(res.user.language as AppLanguage)
      const claims = decodeJwt(res.token)
      const role = claims?.role ?? res.user.role
      if (NEEDS_APPROVAL.includes(role) && !claims?.approved) return navigate('/pending', { replace: true })
      navigate(from.from && from.from.startsWith(homeFor(role)) ? from.from : homeFor(role), { replace: true })
    },
    onError: (e, v) => {
      if (!isApiError(e)) return
      if (e.code === 'ACCOUNT_LOCKED') return navigate('/account/locked', { state: { phone: v.phone } })
      if (e.code === 'ACCOUNT_SUSPENDED') return navigate('/account/suspended')
      if (e.code === 'PHONE_NOT_VERIFIED') {
        pendingSignup.save({ phone: v.phone, role: 'DRIVER' })
        void s1.resendOtp(v.phone).catch(() => undefined)
        return navigate('/register/verify', { state: { phone: v.phone } })
      }
      if (e.code === 'INVALID_CREDENTIALS') {
        const n = (failures.get(v.phone) ?? 0) + 1
        failures.set(v.phone, n)
        setWarning(n >= 2 && n < 5 ? t('auth.attemptsLeft', { count: 5 - n }) : null)
        setFocus('password')
      }
    },
  })

  const apiError = login.error && isApiError(login.error) && login.error.code !== 'INVALID_CREDENTIALS' ? errorMessage(t, login.error) : null

  return (
    <PageShell title={t('auth.loginTitle')} accent={t('auth.loginAccent')} subtitle={t('auth.loginSubtitle')}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <AuthPanel>
          <form noValidate onSubmit={handleSubmit((v) => login.mutate(v as z.output<typeof schema>))} className="flex flex-col gap-4">
            <Input
              label={t('auth.phone')}
              helper={t('auth.phoneHelper')}
              error={tr(errors.phone?.message)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0555 12 34 56"
              dir="ltr"
              className="text-start rtl:text-end"
              {...register('phone')}
            />
            <PasswordInput
              label={t('auth.password')}
              error={tr(errors.password?.message) ?? (login.error && isApiError(login.error) && login.error.code === 'INVALID_CREDENTIALS' ? t('errors.INVALID_CREDENTIALS') : undefined)}
              autoComplete="current-password"
              {...register('password')}
            />
            {warning && <p className="rounded-lg bg-warning-subtle px-3 py-2 text-xs text-warning" role="status">{warning}</p>}
            {apiError && (
              <p className="rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger" role="alert">
                {apiError}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button type="submit" arrow loading={login.isPending}>
                {t('auth.signIn')}
              </Button>
              <Link to="/forgot-password" className="text-sm font-medium text-brand hover:underline">
                {t('auth.forgot')}
              </Link>
            </div>
            <p className="border-t border-grey-200 pt-4 text-sm text-navy-600">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="font-medium text-brand hover:underline">
                {t('auth.createOne')}
              </Link>
            </p>
          </form>
        </AuthPanel>

        <section className="panel w-full p-5 sm:p-6 lg:max-w-[420px]" aria-labelledby="demo-title">
          <h2 id="demo-title" className="text-h3 font-semibold text-navy-900">
            {t('auth.demoAccounts')}
          </h2>
          <p className="mt-1 text-xs text-navy-600">{t('auth.demoHint')}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {DEMO.map((d) => (
              <li key={d.phone}>
                <button
                  type="button"
                  onClick={() => {
                    setValue('phone', d.phone, { shouldValidate: true })
                    setValue('password', 'Password123', { shouldValidate: true })
                    setWarning(null)
                    login.reset()
                  }}
                  className="pressable flex w-full items-center justify-between gap-2 rounded-xl border border-grey-200 bg-white px-3 py-2 text-start transition-colors hover:border-grey-400"
                >
                  <span>
                    <span className="block text-sm font-medium text-navy-900">{t(`roles.${d.role}`)}</span>
                    <span dir="ltr" className="tabular block text-xs text-navy-600">
                      {d.phone}
                    </span>
                  </span>
                  {d.pending && <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-[11px] text-warning">{t('userStatus.PENDING_APPROVAL')}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  )
}
