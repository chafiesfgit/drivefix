import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { PageShell } from '@/app/layouts/PageShell'
import { s1 } from '@/api'
import { isApiError } from '@/api/http'
import { Button, Input, PasswordInput, useToast } from '@/design/ui'
import { isMocked } from '@/lib/env'
import { errorMessage } from '@/lib/errors'
import { AuthPanel } from './AuthPanel'
import { passwordSchema, phoneSchema, tr } from './shared'

const forgotSchema = z.object({ phone: phoneSchema })

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) })
  const send = useMutation({
    mutationFn: (phone: string) => s1.forgotPassword(phone),
    meta: { silent: true },
    onSuccess: (_r, phone) => {
      toast.info(t('auth.codeSent'))
      navigate(`/reset-password?phone=${encodeURIComponent(phone)}`)
    },
  })
  return (
    <PageShell title={t('auth.forgotTitle')} accent={t('auth.forgotAccent')} subtitle={t('auth.forgotSubtitle')}>
      <AuthPanel>
        <form noValidate onSubmit={handleSubmit((v) => send.mutate((v as z.output<typeof forgotSchema>).phone))} className="flex flex-col gap-4">
          <Input
            label={t('auth.phone')}
            helper={t('auth.phoneHelper')}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            className="text-start rtl:text-end"
            placeholder="0555 12 34 56"
            error={tr(errors.phone?.message) ?? (send.error ? errorMessage(t, send.error) : undefined)}
            {...register('phone')}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="submit" arrow loading={send.isPending}>
              {t('auth.sendCode')}
            </Button>
            <Link to="/login" className="text-sm font-medium text-brand hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </div>
        </form>
      </AuthPanel>
    </PageShell>
  )
}

const resetSchema = z
  .object({
    phone: phoneSchema,
    code: z.string().regex(/^\d{6}$/, { message: 'validation.code' }),
    newPassword: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'validation.passwordMatch' })

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { phone: params.get('phone') ?? '', code: '', newPassword: '', confirm: '' },
  })
  const reset = useMutation({
    mutationFn: (v: z.output<typeof resetSchema>) => s1.resetPassword(v.phone, v.code, v.newPassword),
    meta: { silent: true },
    onSuccess: (_r, v) => {
      toast.success(t('auth.passwordUpdated'))
      navigate('/login', { replace: true, state: { phone: v.phone } })
    },
  })
  const err = reset.error
  const codeError = err && isApiError(err) && err.code.startsWith('OTP_') ? errorMessage(t, err) : undefined
  const otherError = err && !codeError ? errorMessage(t, err) : undefined
  return (
    <PageShell title={t('auth.resetTitle')} accent={t('auth.resetAccent')} subtitle={t('auth.resetSubtitle')}>
      <AuthPanel>
        <form noValidate onSubmit={handleSubmit((v) => reset.mutate(v as z.output<typeof resetSchema>))} className="flex flex-col gap-4">
          <Input label={t('auth.phone')} type="tel" inputMode="tel" dir="ltr" className="text-start rtl:text-end" autoComplete="tel" error={tr(errors.phone?.message)} {...register('phone')} />
          <Input
            label={t('auth.codeLabel')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            dir="ltr"
            className="tabular text-start tracking-[0.4em] rtl:text-end"
            helper={isMocked('s1') ? t('auth.mockOtpHint') : t('auth.devOtpHint')}
            error={tr(errors.code?.message) ?? codeError}
            {...register('code')}
          />
          <PasswordInput label={t('auth.newPassword')} helper={t('validation.passwordMin')} autoComplete="new-password" error={tr(errors.newPassword?.message)} {...register('newPassword')} />
          <PasswordInput label={t('auth.confirmPassword')} autoComplete="new-password" error={tr(errors.confirm?.message)} {...register('confirm')} />
          {otherError && (
            <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">
              {otherError}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="submit" arrow loading={reset.isPending}>
              {t('auth.updatePassword')}
            </Button>
            <Link to="/forgot-password" className="text-sm font-medium text-brand hover:underline">
              {t('auth.resend')}
            </Link>
          </div>
        </form>
      </AuthPanel>
    </PageShell>
  )
}
