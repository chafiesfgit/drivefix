import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Car, ChevronRight, Package, ShieldCheck, Truck, Wrench } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { PageShell } from '@/app/layouts/PageShell'
import { s1 } from '@/api'
import { isApiError } from '@/api/http'
import type { RegisterRole } from '@/api/s1'
import { cn } from '@/design/cn'
import { Button, Checkbox, Input, PasswordInput, Select } from '@/design/ui'
import type { AppLanguage } from '@/i18n'
import { errorMessage } from '@/lib/errors'
import { wilayaOptions } from '@/lib/wilayas'
import { AuthPanel } from './AuthPanel'
import { passwordSchema, pendingSignup, phoneSchema, tr } from './shared'

const ROLES: { role: RegisterRole; icon: typeof Car; key: string }[] = [
  { role: 'DRIVER', icon: Car, key: 'Driver' },
  { role: 'SUPPLIER', icon: Package, key: 'Supplier' },
  { role: 'MECHANIC', icon: Wrench, key: 'Mechanic' },
  { role: 'TOW_DRIVER', icon: Truck, key: 'Tow' },
]

function makeSchema(role: RegisterRole) {
  const pro = role !== 'DRIVER'
  // Role fields live in the object shape (not in superRefine) so an empty submit flags every missing field at once:
  // zod skips object-level refinements while any base field is invalid.
  const required = z.string().trim().min(1, { message: 'validation.required' })
  const optional = z.string().trim().optional()
  return z
    .object({
      fullName: z.string().trim().min(2, { message: 'validation.required' }).max(120),
      phone: phoneSchema,
      password: passwordSchema,
      confirm: z.string().min(1, { message: 'validation.required' }),
      language: z.enum(['ar', 'fr', 'en']),
      businessName: role === 'SUPPLIER' || role === 'MECHANIC' ? required : optional,
      wilaya: pro ? required : optional,
      documentNumber: pro ? required : optional,
      vehiclePlate: role === 'TOW_DRIVER' ? required : optional,
      terms: z.boolean().refine((v) => v, { message: 'validation.terms' }),
    })
    .superRefine((v, ctx) => {
      if (v.password !== v.confirm) ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'validation.passwordMatch' })
    })
}

function RoleChooser() {
  const { t } = useTranslation()
  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="role-title">
      <h2 id="role-title" className="text-h3 font-semibold text-navy-900">
        {t('auth.chooseRole')}
      </h2>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {ROLES.map(({ role, icon: Icon, key }) => (
          <li key={role}>
            <Link
              to={`/register?role=${role}`}
              className="group flex h-full items-start gap-4 rounded-card border border-grey-200 bg-white p-4 transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-orange/50 hover:shadow-panel"
            >
              <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', role === 'DRIVER' ? 'bg-orange text-white' : 'bg-night text-white')}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-h3 font-semibold text-navy-900">{t(`auth.role${key}`)}</span>
                <span className="mt-0.5 block text-sm text-navy-600">{t(`auth.role${key}Desc`)}</span>
                {role !== 'DRIVER' && (
                  <span className="mt-2 inline-flex items-center gap-1 text-xs text-warning">
                    <ShieldCheck className="size-3.5" aria-hidden />
                    {t('auth.needsApproval')}
                  </span>
                )}
              </span>
              <ChevronRight className="flip-rtl mt-3 size-4 shrink-0 text-grey-400 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm text-navy-600">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-brand hover:underline">
          {t('auth.signIn')}
        </Link>
      </p>
    </section>
  )
}

function RegisterForm({ role }: { role: RegisterRole }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const schema = useMemo(() => makeSchema(role), [role])
  type Form = z.input<typeof schema>
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { language: (i18n.resolvedLanguage ?? 'en') as AppLanguage, terms: false, fullName: '', phone: '', password: '', confirm: '' },
  })

  const mutation = useMutation({
    mutationFn: (v: z.output<typeof schema>) =>
      s1.register({
        fullName: v.fullName,
        phone: v.phone,
        password: v.password,
        role,
        language: v.language,
        ...(role !== 'DRIVER' && { wilaya: v.wilaya, documentNumber: v.documentNumber }),
        ...((role === 'SUPPLIER' || role === 'MECHANIC') && { businessName: v.businessName }),
        ...(role === 'TOW_DRIVER' && { vehiclePlate: v.vehiclePlate }),
      }),
    meta: { silent: true },
    onSuccess: (res, v) => {
      pendingSignup.save({ phone: res.otpSentTo || v.phone, role })
      navigate('/register/verify', { state: { phone: res.otpSentTo || v.phone, role } })
    },
    onError: (e) => {
      if (isApiError(e) && e.field && e.field in schema.shape) {
        setError(e.field as keyof Form, { message: errorMessage(t, e) })
      }
    },
  })

  const pro = role !== 'DRIVER'
  const roleKey = ROLES.find((r) => r.role === role)!.key
  const formError = mutation.error && !(isApiError(mutation.error) && mutation.error.field) ? errorMessage(t, mutation.error) : null
  const lang = i18n.resolvedLanguage ?? 'en'

  return (
    <AuthPanel title={t(`auth.role${roleKey}`)} description={t(`auth.role${roleKey}Desc`)} className="max-w-[560px]">
      <form noValidate onSubmit={handleSubmit((v) => mutation.mutate(v as z.output<typeof schema>))} className="grid gap-4 sm:grid-cols-2">
        <Input containerClassName="sm:col-span-2" label={t('auth.fullName')} autoComplete="name" required error={tr(errors.fullName?.message)} {...register('fullName')} />
        <Input
          containerClassName="sm:col-span-2"
          label={t('auth.phone')}
          helper={t('auth.phoneHelper')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0555 12 34 56"
          dir="ltr"
          className="text-start rtl:text-end"
          required
          error={tr(errors.phone?.message)}
          {...register('phone')}
        />
        {(role === 'SUPPLIER' || role === 'MECHANIC') && (
          <Input
            containerClassName="sm:col-span-2"
            label={role === 'MECHANIC' ? t('auth.garageName') : t('auth.businessName')}
            autoComplete="organization"
            required
            error={tr(errors.businessName?.message)}
            {...register('businessName')}
          />
        )}
        {pro && (
          <>
            <Select label={t('auth.wilaya')} placeholder="—" options={wilayaOptions(lang)} required error={tr(errors.wilaya?.message)} {...register('wilaya')} />
            <Input label={t('auth.documentNumber')} helper={t('auth.documentHelper')} required error={tr(errors.documentNumber?.message)} {...register('documentNumber')} />
          </>
        )}
        {role === 'TOW_DRIVER' && (
          <Input
            containerClassName="sm:col-span-2"
            label={t('auth.vehiclePlate')}
            helper={t('auth.plateHelper')}
            dir="ltr"
            className="text-start rtl:text-end"
            required
            error={tr(errors.vehiclePlate?.message)}
            {...register('vehiclePlate')}
          />
        )}
        <PasswordInput label={t('auth.password')} helper={t('validation.passwordMin')} autoComplete="new-password" required error={tr(errors.password?.message)} {...register('password')} />
        <PasswordInput label={t('auth.confirmPassword')} autoComplete="new-password" required error={tr(errors.confirm?.message)} {...register('confirm')} />
        <Select
          containerClassName="sm:col-span-2"
          label={t('auth.preferredLanguage')}
          options={[
            { value: 'ar', label: 'العربية' },
            { value: 'fr', label: 'Français' },
            { value: 'en', label: 'English' },
          ]}
          {...register('language')}
        />
        <Checkbox
          className="sm:col-span-2"
          label={
            <>
              {t('auth.acceptTerms')} (
              <Link to="/terms" target="_blank" className="text-brand underline">
                {t('nav.terms')}
              </Link>
              ,{' '}
              <Link to="/privacy" target="_blank" className="text-brand underline">
                {t('nav.privacy')}
              </Link>
              )
            </>
          }
          error={tr(errors.terms?.message)}
          {...register('terms')}
        />
        {formError && (
          <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger sm:col-span-2">
            {formError}
            {isApiError(mutation.error) && mutation.error.code === 'PHONE_TAKEN' && (
              <>
                {' '}
                <Link to="/login" className="font-medium underline">
                  {t('auth.signIn')}
                </Link>
              </>
            )}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-1 sm:col-span-2">
          <Button type="submit" arrow loading={mutation.isPending}>
            {t('auth.createAccount')}
          </Button>
          <Link to="/register" className="text-sm font-medium text-brand hover:underline">
            {t('auth.changeRole')}
          </Link>
        </div>
      </form>
    </AuthPanel>
  )
}

export function RegisterPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const roleParam = params.get('role') as RegisterRole | null
  const role = ROLES.some((r) => r.role === roleParam) ? roleParam : null
  return (
    <PageShell title={t('auth.registerTitle')} accent={t('auth.registerAccent')} subtitle={t('auth.registerSubtitle')}>
      {role ? <RegisterForm key={role} role={role} /> : <RoleChooser />}
    </PageShell>
  )
}
