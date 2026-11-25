import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Home, MessageSquareText, Phone, Plus, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageShell } from '@/app/layouts/PageShell'
import { s3 } from '@/api'
import type { Booking, MechanicService } from '@/api/models'
import { cn } from '@/design/cn'
import { Button, ButtonLink, DataTable, EmptyState, ErrorState, Input, Modal, Panel, StatTile, StatusChip, Textarea, useToast, type Column } from '@/design/ui'
import { BOOKING_TONE } from '@/lib/domain'
import { errorMessage } from '@/lib/errors'
import { useAuth } from '@/lib/auth'
import { formatDate, formatDZD, formatPhone } from '@/lib/format'

const todayISO = () => new Date().toISOString().slice(0, 10)

function useBookingAction() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ b, to, reason }: { b: Booking; to: 'CONFIRMED' | 'REJECTED' | 'IN_PROGRESS' | 'DONE'; reason?: string }) => s3.setBookingStatus(b.id, to, reason),
    onSuccess: (b) => {
      toast.success(t('mechanic.moved', { status: t(`bookings.status.${b.status}`) }))
      void qc.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

function BookingCard({ b, onReject }: { b: Booking; onReject?: (b: Booking) => void }) {
  const { t } = useTranslation()
  const act = useBookingAction()
  const busy = act.isPending
  return (
    <li className="rounded-xl border border-grey-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-navy-900">{b.serviceName ?? t('mechanics.service')} · <span className="tabular">{formatDZD(b.price)}</span></p>
          <p className="tabular mt-0.5 text-xs text-navy-600">{formatDate(b.date)} · {b.startTime}</p>
          <p className="mt-1 text-xs text-navy-600">
            {b.driverName ?? '—'}
            {b.driverPhone && <> · <a href={`tel:${b.driverPhone}`} className="inline-flex items-center gap-1 text-brand" dir="ltr"><Phone className="size-3" aria-hidden />{formatPhone(b.driverPhone)}</a></>}
          </p>
          {b.vehicle && <p className="mt-1 text-xs text-navy-600">{b.vehicle}</p>}
          {b.place === 'AT_CLIENT' && <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-info-subtle px-2 py-0.5 text-xs text-info"><Home className="size-3" aria-hidden />{b.clientAddress}</p>}
          {b.note && <p className="mt-2 break-words rounded-lg bg-cream-100 px-3 py-2 text-xs text-navy-900">{b.note}</p>}
        </div>
        <StatusChip tone={BOOKING_TONE[b.status]}>{t(`bookings.status.${b.status}`)}</StatusChip>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {b.status === 'PENDING' && (
          <>
            <Button size="sm" loading={busy && act.variables?.to === 'CONFIRMED'} onClick={() => act.mutate({ b, to: 'CONFIRMED' })}>{t('mechanic.accept')}</Button>
            <Button size="sm" variant="secondary" onClick={() => onReject?.(b)}>{t('admin.reject')}</Button>
          </>
        )}
        {b.status === 'CONFIRMED' && <Button size="sm" variant="accent" loading={busy} onClick={() => act.mutate({ b, to: 'IN_PROGRESS' })}>{t('mechanic.start')}</Button>}
        {b.status === 'IN_PROGRESS' && <Button size="sm" loading={busy} onClick={() => act.mutate({ b, to: 'DONE' })}>{t('mechanic.finish')}</Button>}
      </div>
    </li>
  )
}

function RejectModal({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const { t } = useTranslation()
  const act = useBookingAction()
  const [reason, setReason] = useState('')
  return (
    <Modal
      open={Boolean(booking)}
      onClose={onClose}
      title={t('mechanic.rejectTitle')}
      busy={act.isPending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" arrow disabled={reason.trim().length < 3} loading={act.isPending} onClick={() => act.mutate({ b: booking!, to: 'REJECTED', reason: reason.trim() }, { onSuccess: onClose })}>{t('admin.reject')}</Button>
        </>
      }
    >
      <Textarea label={t('admin.reason')} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('mechanic.rejectPh')} />
    </Modal>
  )
}

export function MechanicDashboard() {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['bookings', 'mechanic'], queryFn: () => s3.bookings({ page: 1, pageSize: 100 }), refetchInterval: 15_000 })
  const [rejecting, setRejecting] = useState<Booking | null>(null)
  const items = q.data?.items ?? []
  const pending = items.filter((b) => b.status === 'PENDING')
  const today = items.filter((b) => b.date === todayISO() && ['CONFIRMED', 'IN_PROGRESS'].includes(b.status))
  const done = items.filter((b) => b.status === 'DONE')
  return (
    <PageShell accent={t('mechanic.dashTitle')} subtitle={t('mechanic.dashSubtitle')}>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile value={q.isPending ? '…' : pending.length} label={t('mechanic.newRequests')} />
        <StatTile value={q.isPending ? '…' : today.length} label={t('mechanic.today')} />
        <StatTile value={formatDZD(done.reduce((s, b) => s + b.price, 0))} label={t('mechanic.earned')} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title={t('mechanic.newRequests')} actions={<ButtonLink to="/app/mechanic/requests" size="sm" variant="ghost">{t('common.seeAll')}</ButtonLink>}>
          {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : pending.length === 0 ? <EmptyState title={t('mechanic.noRequests')} className="py-6" /> : <ul className="flex flex-col gap-3">{pending.slice(0, 3).map((b) => <BookingCard key={b.id} b={b} onReject={setRejecting} />)}</ul>}
        </Panel>
        <Panel title={t('mechanic.today')} actions={<ButtonLink to="/app/mechanic/schedule" size="sm" variant="ghost">{t('nav.schedule')}</ButtonLink>}>
          {today.length === 0 ? <EmptyState title={t('mechanic.nothingToday')} className="py-6" /> : <ul className="flex flex-col gap-3">{today.map((b) => <BookingCard key={b.id} b={b} />)}</ul>}
        </Panel>
      </div>
      <RejectModal booking={rejecting} onClose={() => setRejecting(null)} />
    </PageShell>
  )
}

export function MechanicRequestsPage() {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['bookings', 'mechanic', 'PENDING'], queryFn: () => s3.bookings({ status: 'PENDING', page: 1, pageSize: 50 }), refetchInterval: 10_000 })
  const [rejecting, setRejecting] = useState<Booking | null>(null)
  return (
    <PageShell accent={t('mechanic.requestsTitle')} subtitle={t('mechanic.requestsSubtitle')}>
      <Panel title={t('mechanic.newRequests')}>
        {q.isError ? <ErrorState onRetry={() => q.refetch()} description={errorMessage(t, q.error)} /> : q.isPending ? <p className="text-sm text-navy-600">{t('common.loading')}</p> : q.data.items.length === 0 ? <EmptyState title={t('mechanic.noRequests')} /> : (
          <ul className="grid gap-3 md:grid-cols-2">{q.data.items.map((b) => <BookingCard key={b.id} b={b} onReject={setRejecting} />)}</ul>
        )}
      </Panel>
      <RejectModal booking={rejecting} onClose={() => setRejecting(null)} />
    </PageShell>
  )
}

/** Week view, Algerian week (Saturday -> Thursday, Friday closed). */
export function MechanicSchedulePage() {
  const { t, i18n } = useTranslation()
  const q = useQuery({ queryKey: ['bookings', 'mechanic', 'schedule'], queryFn: () => s3.bookings({ status: 'CONFIRMED,IN_PROGRESS,DONE', page: 1, pageSize: 100 }) })
  const days = useMemo(() => {
    const d = new Date()
    const back = (d.getDay() + 1) % 7 // days since Saturday
    d.setDate(d.getDate() - back)
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(d)
      x.setDate(d.getDate() + i)
      return x
    })
  }, [])
  const fmt = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-DZ-u-nu-latn' : i18n.language, { weekday: 'long', day: 'numeric', month: 'short' })
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return (
    <PageShell accent={t('mechanic.scheduleTitle')} subtitle={t('mechanic.scheduleSubtitle')}>
      {q.isError ? <Panel><ErrorState onRetry={() => q.refetch()} /></Panel> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {days.map((d) => {
            const list = (q.data?.items ?? []).filter((b) => b.date === iso(d)).sort((a, b) => a.startTime.localeCompare(b.startTime))
            const closed = d.getDay() === 5
            const isToday = iso(d) === todayISO()
            return (
              <Panel key={iso(d)} title={<span className={cn(isToday && 'text-orange-hover')}>{fmt.format(d)}</span>} className={cn(closed && 'opacity-60')}>
                {closed ? <p className="text-sm text-navy-600">{t('mechanics.closed')}</p> : list.length === 0 ? <p className="text-sm text-navy-600">{t('mechanic.free')}</p> : (
                  <ul className="flex flex-col gap-3">{list.map((b) => <BookingCard key={b.id} b={b} />)}</ul>
                )}
              </Panel>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}

export function MechanicServicesPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['services', 'me'], queryFn: () => s3.myServices() })
  const [edit, setEdit] = useState<{ open: boolean; svc?: MechanicService }>({ open: false })
  const [form, setForm] = useState({ name: '', price: '', duration: '60' })
  const [touched, setTouched] = useState(false)
  const openModal = (svc?: MechanicService) => {
    setForm({ name: svc?.name ?? '', price: svc ? String(svc.price) : '', duration: String(svc?.durationMin ?? 60) })
    setTouched(false)
    setEdit({ open: true, svc })
  }
  const int = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : NaN)
  const errs = { name: form.name.trim().length < 2 ? t('validation.required') : undefined, price: !(int(form.price) > 0) ? t('validation.positiveInt') : undefined, duration: !(int(form.duration) > 0) ? t('validation.positiveInt') : undefined }
  const save = useMutation({
    mutationFn: () => (edit.svc ? s3.updateService(edit.svc.id, { name: form.name.trim(), price: int(form.price), durationMin: int(form.duration) }) : s3.createService({ name: form.name.trim(), price: int(form.price), durationMin: int(form.duration) })),
    meta: { silent: true },
    onSuccess: () => {
      toast.success(t('mechanic.serviceSaved'))
      setEdit({ open: false })
      void qc.invalidateQueries({ queryKey: ['services'] })
    },
  })
  const toggle = useMutation({ mutationFn: (s: MechanicService) => s3.updateService(s.id, { active: !s.active }), onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }) })
  const del = useMutation({ mutationFn: (s: MechanicService) => s3.deleteService(s.id), onSuccess: () => { toast.success(t('mechanic.serviceDeleted')); void qc.invalidateQueries({ queryKey: ['services'] }) } })
  const columns: Column<MechanicService>[] = [
    { key: 'name', header: t('mechanics.service'), primary: true, cell: (s) => s.name },
    { key: 'price', header: t('admin.price'), cell: (s) => <span className="tabular">{formatDZD(s.price)}</span> },
    { key: 'dur', header: t('mechanic.duration'), cell: (s) => t('mechanics.duration', { count: s.durationMin }) },
    { key: 'active', header: t('admin.status'), cell: (s) => <button type="button" onClick={() => toggle.mutate(s)} aria-label={s.active ? t('supplier.deactivate') : t('supplier.activate')}><StatusChip tone={s.active ? 'success' : 'neutral'}>{s.active ? t('supplier.active') : t('supplier.inactive')}</StatusChip></button> },
    { key: 'act', header: <span className="sr-only">{t('admin.actions')}</span>, className: 'w-[180px] text-end', cell: (s) => <span className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => openModal(s)}>{t('common.edit')}</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => del.mutate(s)}>{t('common.delete')}</Button></span> },
  ]
  return (
    <PageShell accent={t('mechanic.servicesTitle')} subtitle={t('mechanic.servicesSubtitle')} actions={<Button variant="white" icon={<Plus className="size-4" aria-hidden />} onClick={() => openModal()}>{t('mechanic.addService')}</Button>}>
      <Panel title={t('mechanics.services')}>
        {q.isError ? <ErrorState onRetry={() => q.refetch()} description={errorMessage(t, q.error)} /> : <DataTable columns={columns} rows={q.data?.items} rowKey={(s) => s.id} loading={q.isPending} empty={<EmptyState title={t('mechanics.noServices')} action={<Button arrow onClick={() => openModal()}>{t('mechanic.addService')}</Button>} />} />}
      </Panel>
      <Modal
        open={edit.open}
        onClose={() => setEdit({ open: false })}
        title={edit.svc ? t('mechanic.editService') : t('mechanic.addService')}
        busy={save.isPending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit({ open: false })}>{t('common.cancel')}</Button>
            <Button arrow loading={save.isPending} onClick={() => { setTouched(true); if (!errs.name && !errs.price && !errs.duration) save.mutate() }}>{t('common.save')}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input containerClassName="sm:col-span-2" label={t('mechanics.service')} required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={touched ? errs.name : undefined} />
          <Input label={t('supplier.priceDzd')} inputMode="numeric" required value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} error={touched ? errs.price : undefined} />
          <Input label={t('mechanic.durationMin')} inputMode="numeric" required value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} error={touched ? errs.duration : undefined} />
        </div>
        <p className="mt-3 text-xs text-navy-600">{t('mechanic.priceNote')}</p>
        {save.error && <p role="alert" className="mt-3 rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">{errorMessage(t, save.error)}</p>}
      </Modal>
    </PageShell>
  )
}

/** Spec screens 40-45: what drivers said about this garage (S3 GET /mechanics/{id}, id = the mechanic's user id). */
export function MechanicReviewsPage() {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const q = useQuery({ queryKey: ['mechanic', claims?.sub, 'reviews'], queryFn: () => s3.mechanic(claims!.sub), enabled: Boolean(claims) })
  const reviews = useMemo(() => [...(q.data?.reviews ?? [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), [q.data])
  const average = q.data?.profile.rating ?? (reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : undefined)
  return (
    <PageShell accent={t('nav.reviews')} subtitle={t('mechanic.reviewsSubtitle')}>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="panel self-start p-6">
          <p className="flex items-center gap-2 font-stat text-[56px] font-light leading-none text-navy-900">
            {average !== undefined && reviews.length ? average.toFixed(1) : '—'}
            <Star className="size-7 fill-orange text-orange" aria-hidden />
          </p>
          <p className="mt-3 text-sm text-navy-600">{t('supplier.reviewsCount', { count: reviews.length })}</p>
        </div>
        <Panel title={t('nav.reviews')}>
          {q.isError ? (
            <ErrorState description={errorMessage(t, q.error)} onRetry={() => q.refetch()} />
          ) : q.isPending ? (
            <p className="py-6 text-sm text-navy-600">{t('common.loading')}</p>
          ) : reviews.length === 0 ? (
            <EmptyState icon={<MessageSquareText className="size-5" aria-hidden />} title={t('mechanics.noReviews')} description={t('mechanic.reviewsEmptyBody')} />
          ) : (
            <ul className="flex flex-col gap-4">
              {reviews.map((r) => (
                <li key={r.id} className="border-b border-grey-200/70 pb-4 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold">
                      <Star className="size-4 fill-orange text-orange" aria-hidden />
                      <span className="sr-only">{t('reviews.stars', { count: r.rating })}</span>
                      <span aria-hidden>{r.rating}</span>
                    </span>
                    <span className="text-xs text-navy-600">{formatDate(r.createdAt)}</span>
                  </div>
                  {r.comment && <p className="mt-2 break-words text-sm text-navy-900">{r.comment}</p>}
                  {r.authorName && <p className="mt-1 text-xs text-navy-600">{r.authorName}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageShell>
  )
}
