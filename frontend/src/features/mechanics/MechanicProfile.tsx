import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarCheck, Clock, MapPin } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '@/app/layouts/PageShell'
import { s3 } from '@/api'
import { isApiError } from '@/api/http'
import { cn } from '@/design/cn'
import { Button, ButtonLink, EmptyState, ErrorState, Input, ListRow, Modal, Panel, Skeleton, Tag, Textarea, TrustBadge } from '@/design/ui'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatDZD } from '@/lib/format'
import { wilayaLabel } from '@/lib/wilayas'
import { Rating } from './MechanicsBrowser'

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Next 8 days; Friday is shown but closed (Algerian week: Saturday -> Thursday). */
function nextDays(n = 8) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })
}

function BookingPanel({ mechanicId, offersMobile, services }: { mechanicId: string; offersMobile: boolean; services: { id: string; name: string; price: number; durationMin: number }[] }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { role } = useAuth()
  const days = useMemo(() => nextDays(), [])
  const firstOpen = days.find((d) => d.getDay() !== 5) ?? days[0]
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [date, setDate] = useState(localISO(firstOpen))
  const [time, setTime] = useState('')
  const [place, setPlace] = useState<'GARAGE' | 'AT_CLIENT'>('GARAGE')
  const [address, setAddress] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)

  const slots = useQuery({ queryKey: ['slots', mechanicId, date, serviceId], queryFn: () => s3.slots(mechanicId, date, serviceId || undefined), enabled: Boolean(date) })
  const book = useMutation({
    mutationFn: () => s3.book({ mechanicId, serviceId, date, startTime: time, place, clientAddress: place === 'AT_CLIENT' ? address : undefined, vehicle: vehicle || undefined, note: note || undefined }),
    meta: { silent: true },
    onSuccess: () => {
      setDone(true)
      void qc.invalidateQueries({ queryKey: ['bookings'] })
    },
    onError: (e) => {
      if (isApiError(e) && e.code === 'SLOT_TAKEN') {
        setTime('')
        void slots.refetch()
      }
    },
  })
  const service = services.find((s) => s.id === serviceId)
  const dayFmt = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-DZ-u-nu-latn' : i18n.language, { weekday: 'short', day: 'numeric' })

  if (role !== 'DRIVER') {
    return (
      <Panel title={t('mechanics.bookTitle')}>
        <p className="text-sm text-navy-600">{t('mechanics.signInToBook')}</p>
        <ButtonLink to="/login" state={{ from: `/app/driver/mechanics/${mechanicId}` }} arrow className="mt-4">
          {t('auth.signIn')}
        </ButtonLink>
      </Panel>
    )
  }
  if (services.length === 0) return <Panel title={t('mechanics.bookTitle')}><EmptyState title={t('mechanics.noServices')} /></Panel>

  const canBook = serviceId && date && time && (place === 'GARAGE' || address.trim().length > 3)

  return (
    <Panel title={t('mechanics.bookTitle')} className="self-start">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canBook) book.mutate()
        }}
        className="flex flex-col gap-5"
      >
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-navy-900">{t('mechanics.service')}</legend>
          <div className="flex flex-col gap-2">
            {services.map((s) => (
              <label key={s.id} className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5 transition-colors', serviceId === s.id ? 'border-brand ring-1 ring-brand' : 'border-grey-200 hover:border-grey-400')}>
                <span className="flex items-center gap-2.5">
                  <input type="radio" name="service" value={s.id} checked={serviceId === s.id} onChange={() => setServiceId(s.id)} className="accent-brand" />
                  <span>
                    <span className="block text-sm font-medium text-navy-900">{s.name}</span>
                    <span className="text-xs text-navy-600">{t('mechanics.duration', { count: s.durationMin })}</span>
                  </span>
                </span>
                <span className="tabular text-sm font-semibold text-navy-900">{formatDZD(s.price)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-navy-900">{t('mechanics.day')}</legend>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {days.map((d) => {
              const iso = localISO(d)
              const closed = d.getDay() === 5
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={closed}
                  aria-pressed={date === iso}
                  onClick={() => {
                    setDate(iso)
                    setTime('')
                  }}
                  className={cn('pressable flex h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-xl border px-2 text-xs transition-colors', date === iso ? 'border-night bg-night text-white' : 'border-grey-200 bg-white text-navy-900 hover:border-grey-400', closed && 'cursor-not-allowed bg-sand text-grey-400 line-through')}
                >
                  {dayFmt.format(d)}
                  {closed && <span className="sr-only">{t('mechanics.closed')}</span>}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-navy-900">{t('mechanics.time')}</legend>
          {slots.isPending ? (
            <div className="flex flex-wrap gap-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9 w-16 rounded-full" />)}</div>
          ) : slots.isError ? (
            <ErrorState onRetry={() => slots.refetch()} className="py-4" />
          ) : slots.data.slots.length === 0 ? (
            <p className="text-sm text-navy-600">{t('mechanics.noSlots')}</p>
          ) : (
            <div dir="ltr" className="flex flex-wrap gap-2">
              {slots.data.slots.map((s) => (
                <button key={s} type="button" aria-pressed={time === s} onClick={() => setTime(s)} className={cn('pressable tabular h-9 rounded-full border px-3.5 text-sm transition-colors', time === s ? 'border-night bg-night font-semibold text-white' : 'border-grey-200 bg-white text-navy-900 hover:border-grey-400')}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        {offersMobile && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-navy-900">{t('mechanics.where')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['GARAGE', 'AT_CLIENT'] as const).map((p) => (
                <button key={p} type="button" aria-pressed={place === p} onClick={() => setPlace(p)} className={cn('pressable rounded-xl border px-3 py-2.5 text-sm transition-colors', place === p ? 'border-night bg-night text-white' : 'border-grey-200 bg-white text-navy-900')}>
                  {p === 'GARAGE' ? t('mechanics.atGarage') : t('mechanics.atYourPlace')}
                </button>
              ))}
            </div>
            {place === 'AT_CLIENT' && <Input containerClassName="mt-3" label={t('mechanics.yourAddress')} required value={address} onChange={(e) => setAddress(e.target.value)} helper={t('mechanics.atClientHelp')} />}
          </fieldset>
        )}

        <Input label={t('mechanics.vehicle')} placeholder={t('landing.vehiclePh')} value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
        <Textarea label={t('mechanics.note')} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />

        {service && time && (
          <div className="rounded-xl bg-cream-100 p-3 text-sm text-navy-900">
            <ListRow label={service.name} value={formatDZD(service.price)} />
            <ListRow label={t('mechanics.when')} value={`${formatDate(date)} · ${time}`} />
            <p className="mt-2 text-xs text-navy-600">{t('mechanics.payAfter')}</p>
          </div>
        )}
        {book.error && <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">{errorMessage(t, book.error)}</p>}
        <Button type="submit" arrow loading={book.isPending} disabled={!canBook}>
          {t('mechanics.confirmBooking')}
        </Button>
      </form>
      <Modal
        open={done}
        onClose={() => setDone(false)}
        title={t('mechanics.bookedTitle')}
        description={t('mechanics.bookedBody')}
        footer={
          <Button arrow onClick={() => navigate('/app/driver/bookings')}>
            {t('mechanics.seeBookings')}
          </Button>
        }
      >
        <div className="flex items-center gap-3 rounded-xl bg-success-subtle p-3 text-sm text-success">
          <CalendarCheck className="size-5" aria-hidden />
          {service?.name} · {formatDate(date)} · {time}
        </div>
      </Modal>
    </Panel>
  )
}

export function MechanicProfilePage() {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const inApp = location.pathname.startsWith('/app/')
  const query = useQuery({ queryKey: ['mechanic', id], queryFn: () => s3.mechanic(id) })
  const p = query.data?.profile
  return (
    <PageShell title={p?.garageName ?? ' '} subtitle={p ? wilayaLabel(p.wilaya, i18n.language) : undefined}>
      <Link to={inApp ? '/app/driver/mechanics' : '/mechanics'} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {t('mechanics.back')}
      </Link>
      {query.isError ? (
        <Panel>
          <ErrorState onRetry={() => query.refetch()} />
        </Panel>
      ) : query.isPending ? (
        <div className="panel p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="mt-4 h-24" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="flex flex-col gap-6">
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Rating value={p?.rating} count={query.data.reviews.length} />
                <TrustBadge state="verified" label={t('mechanics.verifiedBadge')} />
              </div>
              {p?.bio && <p className="mt-4 text-sm text-navy-600">{p.bio}</p>}
              <div className="mt-4">
                <ListRow label={t('mechanics.address')} value={<span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{p?.address ?? '—'}</span>} />
                {p?.workingHours && Object.entries(p.workingHours).map(([k, v]) => <ListRow key={k} label={<span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{t('mechanics.hours')}</span>} value={<span dir="ltr">{k.replace('-', ' → ')} · {v}</span>} />)}
                <ListRow label={t('mechanics.atYourPlace')} value={p?.offersMobile ? t('common.yes') : t('common.no')} />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">{p?.specialties?.map((s) => <Tag key={s}>{t(`mechanics.spec.${s}`, { defaultValue: s })}</Tag>)}</div>
            </Panel>
            <Panel title={t('mechanics.services')}>
              {query.data.services.length === 0 ? (
                <EmptyState title={t('mechanics.noServices')} />
              ) : (
                query.data.services.map((s) => <ListRow key={s.id} label={`${s.name} · ${t('mechanics.duration', { count: s.durationMin })}`} value={formatDZD(s.price)} />)
              )}
            </Panel>
            <Panel title={t('mechanics.reviews')}>
              {query.data.reviews.length === 0 ? (
                <EmptyState title={t('mechanics.noReviews')} />
              ) : (
                <ul className="flex flex-col gap-4">
                  {query.data.reviews.map((r) => (
                    <li key={r.id} className="border-b border-grey-200/70 pb-4 last:border-0">
                      <div className="flex items-center justify-between gap-3">
                        <Rating value={r.rating} />
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
          <BookingPanel mechanicId={id} offersMobile={Boolean(p?.offersMobile)} services={query.data.services} />
        </div>
      )}
    </PageShell>
  )
}
