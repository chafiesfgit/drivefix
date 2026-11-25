import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageShell } from '@/app/layouts/PageShell'
import { s1, s3 } from '@/api'
import { isApiError } from '@/api/http'
import { Button, Checkbox, Input, ListRow, Panel, Select, StatusChip, Textarea, useToast } from '@/design/ui'
import { setLanguage, type AppLanguage } from '@/i18n'
import { authStore, useAuth } from '@/lib/auth'
import { SPECIALTIES } from '@/lib/domain'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatPhone } from '@/lib/format'
import { wilayaOptions } from '@/lib/wilayas'

function GarageForm({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const current = useQuery({
    queryKey: ['mechanic', userId],
    queryFn: async () => {
      try {
        return await s3.mechanic(userId)
      } catch (e) {
        if (isApiError(e) && e.status === 404) return null
        throw e
      }
    },
  })
  const [f, setF] = useState({ garageName: '', wilaya: '16', address: '', bio: '', offersMobile: false, specialties: [] as string[], hours: '08:00-17:00' })
  useEffect(() => {
    const p = current.data?.profile
    if (p) setF({ garageName: p.garageName, wilaya: p.wilaya, address: p.address ?? '', bio: p.bio ?? '', offersMobile: p.offersMobile, specialties: p.specialties ?? [], hours: Object.values(p.workingHours ?? {})[0] ?? '08:00-17:00' })
  }, [current.data])
  const save = useMutation({
    mutationFn: () => s3.saveProfile({ garageName: f.garageName.trim(), wilaya: f.wilaya, address: f.address || undefined, bio: f.bio || undefined, offersMobile: f.offersMobile, specialties: f.specialties, workingHours: { 'sat-thu': f.hours } }),
    onSuccess: () => {
      toast.success(t('profile.garageSaved'))
      void qc.invalidateQueries({ queryKey: ['mechanic', userId] })
    },
  })
  return (
    <Panel title={t('profile.garage')}>
      <form onSubmit={(e) => { e.preventDefault(); if (f.garageName.trim()) save.mutate() }} className="grid gap-4 sm:grid-cols-2">
        <Input label={t('auth.garageName')} required value={f.garageName} onChange={(e) => setF({ ...f, garageName: e.target.value })} />
        <Select label={t('auth.wilaya')} options={wilayaOptions(i18n.language)} value={f.wilaya} onChange={(e) => setF({ ...f, wilaya: e.target.value })} />
        <Input containerClassName="sm:col-span-2" label={t('mechanics.address')} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        <Input label={t('profile.hours')} helper={t('profile.hoursHelp')} dir="ltr" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} />
        <Checkbox className="self-end pb-2" label={t('mechanics.atYourPlace')} checked={f.offersMobile} onChange={(e) => setF({ ...f, offersMobile: e.target.checked })} />
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium text-navy-900">{t('mechanics.specialty')}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {SPECIALTIES.map((s) => (
              <Checkbox key={s} label={t(`mechanics.spec.${s}`)} checked={f.specialties.includes(s)} onChange={(e) => setF({ ...f, specialties: e.target.checked ? [...f.specialties, s] : f.specialties.filter((x) => x !== s) })} />
            ))}
          </div>
        </fieldset>
        <Textarea containerClassName="sm:col-span-2" label={t('profile.bio')} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={500} />
        {save.error && <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger sm:col-span-2">{errorMessage(t, save.error)}</p>}
        <div className="sm:col-span-2"><Button type="submit" arrow loading={save.isPending}>{t('common.save')}</Button></div>
      </form>
    </Panel>
  )
}

export function ProfilePage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { user, role, claims, approved } = useAuth()
  const me = useQuery({ queryKey: ['me'], queryFn: () => s1.me() })
  const u = me.data ?? user
  const [name, setName] = useState(u?.fullName ?? '')
  const [lang, setLang] = useState<AppLanguage>((u?.language as AppLanguage) ?? 'en')
  useEffect(() => {
    if (me.data) {
      setName(me.data.fullName)
      setLang(me.data.language as AppLanguage)
      authStore.setUser(me.data)
    }
  }, [me.data])
  const save = useMutation({
    mutationFn: () => s1.updateMe({ fullName: name.trim(), language: lang }),
    onSuccess: (nu) => {
      authStore.setUser(nu)
      setLanguage(nu.language as AppLanguage)
      toast.success(t('profile.saved'))
    },
  })
  return (
    <PageShell accent={t('nav.profile')} subtitle={t('profile.subtitle')}>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Panel title={t('profile.personal')}>
            <form onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) save.mutate() }} className="grid gap-4 sm:grid-cols-2">
              <Input label={t('auth.fullName')} required value={name} onChange={(e) => setName(e.target.value)} error={name.trim().length < 2 ? t('validation.required') : undefined} />
              <Select label={t('auth.preferredLanguage')} options={[{ value: 'ar', label: 'العربية' }, { value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} value={lang} onChange={(e) => setLang(e.target.value as AppLanguage)} />
              <Input label={t('auth.phone')} value={formatPhone(u?.phone)} disabled dir="ltr" helper={t('profile.phoneHelp')} />
              <div className="flex items-end"><Button type="submit" arrow loading={save.isPending}>{t('common.save')}</Button></div>
            </form>
          </Panel>
          {role === 'MECHANIC' && claims && <GarageForm userId={claims.sub} />}
        </div>
        <Panel title={t('profile.account')} className="self-start">
          <ListRow label={t('admin.role')} value={role ? t(`roles.${role}`) : '—'} />
          <ListRow label={t('admin.status')} value={u ? <StatusChip tone={u.status === 'ACTIVE' ? 'success' : 'warning'}>{t(`userStatus.${u.status}`)}</StatusChip> : '—'} />
          <ListRow label={t('profile.approved')} value={approved ? t('common.yes') : t('common.no')} />
          <ListRow label={t('admin.joined')} value={formatDate(u?.createdAt)} />
        </Panel>
      </div>
    </PageShell>
  )
}
