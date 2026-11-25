import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Package, Siren, Wrench } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { PageShell } from '@/app/layouts/PageShell'
import { s2, s3, s4 } from '@/api'
import type { Booking } from '@/api/models'
import { Button, ButtonLink, DataTable, EmptyState, ErrorState, Modal, Panel, Segmented, StatusChip, type Column } from '@/design/ui'
import { ReviewModal } from '@/features/common/Rating'
import { MechanicsBrowser } from '@/features/mechanics/MechanicsBrowser'
import { CartButton } from '@/features/parts/PartDetail'
import { PartsBrowser } from '@/features/parts/PartsBrowser'
import { SosForm } from '@/features/towing/SosForm'
import { SosTrackingView } from '@/features/towing/SosTracking'
import { useAuth } from '@/lib/auth'
import { BOOKING_TONE, ORDER_TONE } from '@/lib/domain'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatDZD, shortId } from '@/lib/format'

export { PartDetailPage } from '@/features/parts/PartDetail'
export { MechanicProfilePage as BookMechanicPage } from '@/features/mechanics/MechanicProfile'
export { CartPage, OrdersPage, OrderDetailPage } from './DriverOrders'
export { DriverPaymentsPage } from './DriverPayments'

const ACTIVE_TOW_KEY = 'df.activeTow'

export function DriverDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const orders = useQuery({ queryKey: ['orders', 'recent'], queryFn: () => s2.orders({ page: 1, pageSize: 3 }), meta: { silent: true } })
  const bookings = useQuery({ queryKey: ['bookings', 'upcoming'], queryFn: () => s3.bookings({ status: 'PENDING,CONFIRMED', page: 1, pageSize: 3 }), meta: { silent: true } })
  const first = user?.fullName?.split(' ')[0] ?? ''
  const actions = [
    { to: '/app/driver/parts', icon: Package, title: t('landing.svcPartsTitle'), body: t('landing.svcPartsBody'), cls: 'bg-[linear-gradient(156deg,#16468e_0%,#0b2a5b_47%,#071a3a_78%)]' },
    { to: '/app/driver/mechanics', icon: Wrench, title: t('landing.svcMechTitle'), body: t('landing.svcMechBody'), cls: 'bg-[linear-gradient(156deg,#1a2b4a_0%,#0e1b33_78%)]' },
    { to: '/app/driver/sos', icon: Siren, title: t('landing.svcSosTitle'), body: t('landing.svcSosBody'), cls: 'bg-[linear-gradient(156deg,#f26a1b_0%,#c24a09_78%)]' },
  ]
  return (
    <PageShell title={t('driver.hello', { name: first })} accent={t('driver.helloAccent')} subtitle={t('driver.subtitle')} actions={<CartButton />}>
      <ul className="grid gap-4 md:grid-cols-3">
        {actions.map((a) => (
          <li key={a.to}>
            <Link to={a.to} className={`group flex h-full flex-col gap-3 rounded-panel p-6 text-white shadow-panel transition-transform duration-200 ease-out hover:-translate-y-0.5 ${a.cls}`}>
              <a.icon className="size-6" aria-hidden />
              <span className="text-[26px] font-light tracking-[-0.02em]">{a.title}</span>
              <span className="text-sm text-white/80">{a.body}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title={t('driver.recentOrders')} actions={<ButtonLink to="/app/driver/orders" size="sm" variant="ghost">{t('common.seeAll')}</ButtonLink>}>
          {orders.isError ? <ErrorState onRetry={() => orders.refetch()} className="py-6" /> : orders.data?.items.length === 0 ? <EmptyState title={t('orders.empty')} className="py-6" /> : (
            <ul className="flex flex-col gap-2">
              {orders.data?.items.map((o) => (
                <li key={o.id}>
                  <Link to={`/app/driver/orders/${o.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-grey-200 bg-white px-4 py-3 hover:border-grey-400">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-navy-900">{o.items.map((i) => i.partName).join(', ') || `#${shortId(o.id)}`}</span>
                      <span className="tabular text-xs text-navy-600">{formatDZD(o.total)} · {formatDate(o.createdAt)}</span>
                    </span>
                    <StatusChip tone={ORDER_TONE[o.status]}>{t(`orders.status.${o.status}`)}</StatusChip>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t('driver.upcomingBookings')} actions={<ButtonLink to="/app/driver/bookings" size="sm" variant="ghost">{t('common.seeAll')}</ButtonLink>}>
          {bookings.isError ? <ErrorState onRetry={() => bookings.refetch()} className="py-6" /> : bookings.data?.items.length === 0 ? <EmptyState icon={<CalendarCheck className="size-5" aria-hidden />} title={t('bookings.empty')} className="py-6" /> : (
            <ul className="flex flex-col gap-2">
              {bookings.data?.items.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-grey-200 bg-white px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-navy-900">{b.serviceName ?? t('mechanics.service')} · {b.garageName}</span>
                    <span className="tabular text-xs text-navy-600">{formatDate(b.date)} · {b.startTime}</span>
                  </span>
                  <StatusChip tone={BOOKING_TONE[b.status]}>{t(`bookings.status.${b.status}`)}</StatusChip>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageShell>
  )
}

export function PartsSearchPage() {
  const { t } = useTranslation()
  return (
    <PageShell title={t('parts.title')} accent={t('parts.accent')} subtitle={t('driver.partsSubtitle')} actions={<CartButton />}>
      <PartsBrowser basePath="/app/driver/parts" />
    </PageShell>
  )
}

export function DriverMechanicsPage() {
  const { t } = useTranslation()
  return (
    <PageShell title={t('mechanics.title')} accent={t('mechanics.accent')} subtitle={t('mechanics.subtitle')}>
      <MechanicsBrowser basePath="/app/driver/mechanics" />
    </PageShell>
  )
}

export function BookingsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [cancelling, setCancelling] = useState<Booking | null>(null)
  const [reviewing, setReviewing] = useState<Booking | null>(null)
  const q = useQuery({ queryKey: ['bookings', status], queryFn: () => s3.bookings({ status: status || undefined, page: 1, pageSize: 50 }) })
  const cancel = useMutation({
    mutationFn: (b: Booking) => s3.setBookingStatus(b.id, 'CANCELLED'),
    meta: { silent: true },
    onSuccess: () => {
      setCancelling(null)
      void qc.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
  const review = useMutation({
    mutationFn: ({ b, r, c }: { b: Booking; r: number; c?: string }) => s3.reviewBooking(b.id, r, c),
    meta: { silent: true },
    onSuccess: () => {
      setReviewing(null)
      void qc.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
  const columns: Column<Booking>[] = [
    { key: 'svc', header: t('mechanics.service'), primary: true, cell: (b) => <span>{b.serviceName ?? '—'}<span className="block text-xs font-normal text-navy-600">{b.garageName}</span></span> },
    { key: 'when', header: t('mechanics.when'), cell: (b) => <span className="tabular">{formatDate(b.date)} · {b.startTime}</span> },
    { key: 'place', header: t('mechanics.where'), cell: (b) => (b.place === 'GARAGE' ? t('mechanics.atGarage') : t('mechanics.atYourPlace')) },
    { key: 'price', header: t('admin.price'), cell: (b) => formatDZD(b.price) },
    { key: 'status', header: t('admin.status'), cell: (b) => <StatusChip tone={BOOKING_TONE[b.status]}>{t(`bookings.status.${b.status}`)}</StatusChip> },
    {
      key: 'act',
      header: <span className="sr-only">{t('admin.actions')}</span>,
      className: 'w-[140px] text-end',
      cell: (b) =>
        ['PENDING', 'CONFIRMED'].includes(b.status) ? (
          <Button size="sm" variant="secondary" onClick={() => { cancel.reset(); setCancelling(b) }}>{t('common.cancel')}</Button>
        ) : b.status === 'DONE' ? (
          <Button size="sm" onClick={() => { review.reset(); setReviewing(b) }}>{t('bookings.rate')}</Button>
        ) : null,
    },
  ]
  return (
    <PageShell accent={t('bookings.title')} subtitle={t('bookings.subtitle')} actions={<ButtonLink to="/app/driver/mechanics" variant="white" arrow>{t('bookings.new')}</ButtonLink>}>
      <Panel
        title={t('bookings.history')}
        actions={<Segmented label={t('admin.status')} value={status} onChange={setStatus} options={[{ value: '', label: t('common.all') }, ...(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const).map((s) => ({ value: s, label: t(`bookings.status.${s}`) }))]} />}
      >
        {q.isError ? <ErrorState onRetry={() => q.refetch()} description={errorMessage(t, q.error)} /> : <DataTable columns={columns} rows={q.data?.items} rowKey={(b) => b.id} loading={q.isPending} empty={<EmptyState title={t('bookings.empty')} />} />}
      </Panel>
      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title={t('bookings.cancelTitle')}
        description={t('bookings.cancelBody')}
        busy={cancel.isPending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelling(null)}>{t('common.back')}</Button>
            <Button variant="danger" arrow loading={cancel.isPending} onClick={() => cancel.mutate(cancelling!)}>{t('bookings.cancelConfirm')}</Button>
          </>
        }
      >
        {cancel.error && <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">{errorMessage(t, cancel.error)}</p>}
      </Modal>
      <ReviewModal open={Boolean(reviewing)} onClose={() => setReviewing(null)} title={t('bookings.rate')} busy={review.isPending} error={review.error ? errorMessage(t, review.error) : undefined} onSubmit={(r, c) => review.mutate({ b: reviewing!, r, c })} />
    </PageShell>
  )
}

export function SosRequestPage() {
  const { t } = useTranslation()
  let active: string | null = null
  try {
    active = localStorage.getItem(ACTIVE_TOW_KEY)
  } catch {
    active = null
  }
  const tow = useQuery({ queryKey: ['tow', active], queryFn: () => s4.get(active!), enabled: Boolean(active), retry: false, meta: { silent: true } })
  const live = tow.data && ['SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'NO_DRIVER'].includes(tow.data.request.status)
  return (
    <PageShell title={t('sos.title')} accent={t('sos.accent')} subtitle={t('sos.requestSubtitle')}>
      {live && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-panel bg-orange p-4 text-white shadow-panel">
          <p className="text-sm font-medium">{t('driver.activeTow')}</p>
          <ButtonLink to={`/app/driver/sos/${active}`} variant="white" arrow size="sm">{t('driver.followTow')}</ButtonLink>
        </div>
      )}
      <SosForm />
    </PageShell>
  )
}

export function SosTrackingPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  try {
    localStorage.setItem(ACTIVE_TOW_KEY, id)
  } catch {
    /* ignore */
  }
  return (
    <PageShell title={t('sos.trackTitle')} accent={t('sos.trackAccent')} subtitle={t('sos.trackSubtitle')}>
      <SosTrackingView id={id} />
    </PageShell>
  )
}
