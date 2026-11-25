import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, Navigation, Phone, Power, Truck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageShell } from '@/app/layouts/PageShell'
import { s4, s5 } from '@/api'
import { isApiError } from '@/api/http'
import type { TowRequest } from '@/api/models'
import { cn } from '@/design/cn'
import { Button, EmptyState, ListRow, Panel, StatusChip, useToast } from '@/design/ui'
import { MapView, type LatLng } from '@/design/map/MapView'
import { TOW_TONE } from '@/lib/domain'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatDZD } from '@/lib/format'

const JOB_KEY = 'df.towJob'
const HISTORY_KEY = 'df.towHistory'
const ONLINE_KEY = 'df.towOnline'
const OFFER_S = 30

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k)
      else localStorage.setItem(k, v)
    } catch {
      /* ignore */
    }
  },
}

function pushHistory(job: TowRequest) {
  const list = JSON.parse(store.get(HISTORY_KEY) ?? '[]') as TowRequest[]
  store.set(HISTORY_KEY, JSON.stringify([job, ...list.filter((j) => j.id !== job.id)].slice(0, 30)))
}

/** Countdown ring for the 30-second offer. Respects reduced motion (no transition). */
function Countdown({ seconds }: { seconds: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, seconds / OFFER_S))
  return (
    <div className="relative size-16 shrink-0" role="timer" aria-live="off">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none" />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center font-stat text-xl text-white">{seconds}</span>
    </div>
  )
}

/** Sends the truck position every 7 s while online (GPS if allowed, otherwise a small simulated drift). */
function usePositionBeacon(online: boolean, target: LatLng | null) {
  const pos = useRef<LatLng>({ lat: 36.7538, lng: 3.0588 })
  const [current, setCurrent] = useState<LatLng>(pos.current)
  useEffect(() => {
    if (!online) return
    let watch: number | null = null
    let gps = false
    if (navigator.geolocation) {
      watch = navigator.geolocation.watchPosition(
        (p) => {
          gps = true
          pos.current = { lat: p.coords.latitude, lng: p.coords.longitude }
        },
        () => undefined,
        { enableHighAccuracy: true },
      )
    }
    const tick = () => {
      if (!gps && target) {
        // Simulated drive toward the pickup point (demo without GPS)
        pos.current = { lat: pos.current.lat + (target.lat - pos.current.lat) * 0.15, lng: pos.current.lng + (target.lng - pos.current.lng) * 0.15 }
      }
      setCurrent({ ...pos.current })
      void s4.sendPosition(pos.current.lat, pos.current.lng).catch(() => undefined)
    }
    tick()
    const id = window.setInterval(tick, 7000)
    return () => {
      window.clearInterval(id)
      if (watch !== null) navigator.geolocation.clearWatch(watch)
    }
  }, [online, target])
  return current
}

export function TowDashboard() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [online, setOnline] = useState(store.get(ONLINE_KEY) === '1')
  const [jobId, setJobId] = useState<string | null>(store.get(JOB_KEY))
  const [left, setLeft] = useState(0)

  const availability = useMutation({
    mutationFn: (v: boolean) => s4.setAvailability(v),
    onSuccess: (r) => {
      setOnline(r.available)
      store.set(ONLINE_KEY, r.available ? '1' : null)
      toast.info(r.available ? t('tow.nowOnline') : t('tow.nowOffline'))
    },
  })

  const offer = useQuery({
    queryKey: ['tow-offer'],
    queryFn: async () => {
      try {
        return await s4.myOffer()
      } catch (e) {
        if (isApiError(e) && e.status === 404) return null
        throw e
      }
    },
    enabled: online && !jobId,
    refetchInterval: 3000,
    meta: { silent: true },
  })

  useEffect(() => {
    if (offer.data) setLeft(offer.data.secondsLeft)
  }, [offer.data])
  useEffect(() => {
    if (!offer.data || left <= 0) return
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [left, offer.data])

  const accept = useMutation({
    mutationFn: (id: string) => s4.accept(id),
    meta: { silent: true },
    onSuccess: (tow) => {
      store.set(JOB_KEY, tow.id)
      setJobId(tow.id)
      toast.success(t('tow.accepted'))
      void qc.invalidateQueries({ queryKey: ['tow-offer'] })
    },
    onError: (e) => {
      toast.error(errorMessage(t, e))
      void offer.refetch()
    },
  })
  const decline = useMutation({ mutationFn: (id: string) => s4.decline(id), onSettled: () => offer.refetch() })

  const job = useQuery({ queryKey: ['tow', jobId], queryFn: () => s4.get(jobId!), enabled: Boolean(jobId), refetchInterval: 5000 })
  const req = job.data?.request
  const pickupLat = req?.pickupLat
  const pickupLng = req?.pickupLng
  const driving = Boolean(req && ['ASSIGNED', 'EN_ROUTE'].includes(req.status))
  const pickup = useMemo(() => (pickupLat != null && pickupLng != null ? { lat: pickupLat, lng: pickupLng } : null), [pickupLat, pickupLng])
  const truck = usePositionBeacon(online, driving ? pickup : null)

  const pay = useQuery({ queryKey: ['payment', jobId], queryFn: () => s5.payments({ refId: jobId!, page: 1, pageSize: 1 }), enabled: Boolean(jobId) && req?.status === 'COMPLETED', meta: { silent: true } })
  const collect = useMutation({ mutationFn: (id: string) => s5.cashCollected(id), onSuccess: () => { toast.success(t('supplier.cashCollected')); void pay.refetch() } })

  const move = useMutation({
    mutationFn: (to: 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED') => s4.setStatus(jobId!, to),
    onSuccess: (tow) => {
      void job.refetch()
      if (tow.status === 'COMPLETED') pushHistory(tow)
    },
  })
  const finish = () => {
    if (req) pushHistory(req)
    store.set(JOB_KEY, null)
    setJobId(null)
  }
  const next = req ? ({ ASSIGNED: 'EN_ROUTE', EN_ROUTE: 'ARRIVED', ARRIVED: 'COMPLETED' } as const)[req.status as 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED'] : undefined
  const payment = pay.data?.items[0]
  const o = offer.data

  return (
    <PageShell accent={t('tow.title')} subtitle={t('tow.subtitle')}>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-6">
          <Panel title={t('tow.availability')}>
            <button
              type="button"
              role="switch"
              aria-checked={online}
              disabled={availability.isPending || Boolean(jobId && req && ['ASSIGNED', 'EN_ROUTE', 'ARRIVED'].includes(req.status))}
              onClick={() => availability.mutate(!online)}
              className={cn('pressable flex w-full items-center gap-4 rounded-card border p-4 text-start transition-colors duration-200 disabled:opacity-60', online ? 'border-success bg-success-subtle' : 'border-grey-200 bg-white')}
            >
              <span className={cn('flex size-12 items-center justify-center rounded-full transition-colors duration-200', online ? 'bg-success text-white' : 'bg-sand text-navy-600')}>
                <Power className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-h3 font-semibold text-navy-900">{online ? t('tow.online') : t('tow.offline')}</span>
                <span className="text-xs text-navy-600">{online ? t('tow.onlineHelp') : t('tow.offlineHelp')}</span>
              </span>
            </button>
            {online && <p className="mt-3 text-xs text-navy-600">{t('tow.positionNote')}</p>}
          </Panel>

          {!jobId && online && (
            o && left > 0 ? (
              <section aria-live="assertive" className="animate-pop-in rounded-panel bg-orange p-5 text-white shadow-[0_20px_45px_-5px_rgb(106_35_0/0.4)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow text-white/85">{t('tow.newOffer')}</p>
                    <p className="mt-1 text-h2 font-bold">{o.pickupAddress ?? t('tow.pickupNearby')}</p>
                    <p className="mt-1 text-sm text-white/90">
                      {o.distanceKm != null && <>{o.distanceKm} {t('common.km')} · </>}
                      {o.estimatedPrice != null && formatDZD(o.estimatedPrice)}
                    </p>
                  </div>
                  <Countdown seconds={left} />
                </div>
                <div className="mt-5 flex gap-3">
                  <Button variant="white" arrow loading={accept.isPending} onClick={() => accept.mutate(o.id)}>{t('tow.accept')}</Button>
                  <Button variant="glass" loading={decline.isPending} onClick={() => decline.mutate(o.id)}>{t('tow.decline')}</Button>
                </div>
              </section>
            ) : (
              <Panel>
                <EmptyState icon={<Truck className="size-5" aria-hidden />} title={t('tow.waiting')} description={t('tow.waitingBody')} className="py-6" />
              </Panel>
            )
          )}
        </div>

        <div className="flex flex-col gap-6">
          {req ? (
            <Panel title={t('tow.activeJob')} actions={<StatusChip tone={TOW_TONE[req.status]}>{t(`sos.status.${req.status}`)}</StatusChip>}>
              <MapView center={pickup!} pickup={pickup} truck={['ASSIGNED', 'EN_ROUTE'].includes(req.status) ? truck : null} className="h-[300px] md:h-[380px]" label={t('sos.mapLabel')} />
              <div className="mt-4 grid gap-x-6 md:grid-cols-2">
                <ListRow label={t('sos.address')} value={<span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{req.pickupAddress ?? `${req.pickupLat.toFixed(4)}, ${req.pickupLng.toFixed(4)}`}</span>} />
                {req.vehicle && <ListRow label={t('mechanics.vehicle')} value={req.vehicle} />}
                {req.issue && <ListRow label={t('sos.issue')} value={req.issue} />}
                <ListRow label={t('sos.urgency')} value={t(`sos.${req.urgency.toLowerCase()}`)} />
                {req.estimatedPrice != null && <ListRow label={t('sos.estimatedPrice')} value={formatDZD(req.estimatedPrice)} />}
                {req.guestPhone && <ListRow label={t('auth.phone')} value={<a href={`tel:${req.guestPhone}`} className="inline-flex items-center gap-1 text-brand" dir="ltr"><Phone className="size-3.5" aria-hidden />{req.guestPhone}</a>} />}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <a href={`https://www.openstreetmap.org/directions?to=${req.pickupLat},${req.pickupLng}`} target="_blank" rel="noreferrer" className="pressable inline-flex h-11 items-center gap-2 rounded-full border border-grey-200 bg-white px-5 text-sm font-medium text-navy-900 hover:border-grey-400">
                  <Navigation className="size-4" aria-hidden />
                  {t('tow.directions')}
                </a>
                {next && <Button variant="accent" arrow loading={move.isPending} onClick={() => move.mutate(next)}>{t(`tow.to.${next}`)}</Button>}
                {req.status === 'COMPLETED' && payment?.status === 'PENDING' && <Button loading={collect.isPending} onClick={() => collect.mutate(payment.id)}>{t('supplier.markCash')}</Button>}
                {['COMPLETED', 'CANCELLED'].includes(req.status) && <Button variant="secondary" onClick={finish}>{t('tow.closeJob')}</Button>}
              </div>
            </Panel>
          ) : (
            <Panel title={t('tow.activeJob')}>
              <EmptyState title={t('tow.noJob')} description={online ? t('tow.noJobOnline') : t('tow.noJobOffline')} />
            </Panel>
          )}
        </div>
      </div>
    </PageShell>
  )
}

export function TowHistoryPage() {
  const { t } = useTranslation()
  const list = JSON.parse(store.get(HISTORY_KEY) ?? '[]') as TowRequest[]
  return (
    <PageShell accent={t('tow.historyTitle')} subtitle={t('tow.historySubtitle')}>
      <Panel title={t('nav.history')}>
        {list.length === 0 ? <EmptyState title={t('tow.noHistory')} /> : (
          <ul className="flex flex-col gap-2">
            {list.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-grey-200 bg-white px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-navy-900">{j.pickupAddress ?? j.trackingCode}</span>
                  <span className="text-xs text-navy-600">{formatDate(j.createdAt)} · {j.estimatedPrice != null ? formatDZD(j.estimatedPrice) : '—'}</span>
                </span>
                <StatusChip tone={TOW_TONE[j.status]}>{t(`sos.status.${j.status}`)}</StatusChip>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageShell>
  )
}
