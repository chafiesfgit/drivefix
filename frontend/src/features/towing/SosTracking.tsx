import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Phone, Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router-dom'
import { PageShell } from '@/app/layouts/PageShell'
import { s4 } from '@/api'
import type { TowStatus } from '@/api/models'
import { TOW_TONE } from '@/lib/domain'
import { cn } from '@/design/cn'
import { Button, ErrorState, ListRow, Modal, Panel, Skeleton, StatusChip } from '@/design/ui'
import { MapView } from '@/design/map/MapView'
import { formatDZD, formatPhone } from '@/lib/format'
import { HOTLINE } from './SosForm'

const FLOW: TowStatus[] = ['SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED']


/** Live tracking: polls status and position every 5 s (contract: client polls /track). */
export function SosTrackingView({ id, code }: { id: string; code?: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const detail = useQuery({
    queryKey: ['tow', id, code],
    queryFn: () => s4.get(id, code),
    refetchInterval: (q) => (q.state.data && ['COMPLETED', 'CANCELLED'].includes(q.state.data.request.status) ? false : 5000),
  })
  const status = detail.data?.request.status
  const tracking = useQuery({
    queryKey: ['tow-track', id, code],
    queryFn: () => s4.track(id, code),
    enabled: Boolean(status && ['ASSIGNED', 'EN_ROUTE', 'ARRIVED'].includes(status)),
    refetchInterval: 5000,
    meta: { silent: true },
  })
  const cancel = useMutation({
    mutationFn: () => s4.cancel(id),
    onSuccess: () => {
      setConfirmCancel(false)
      void qc.invalidateQueries({ queryKey: ['tow', id] })
    },
  })

  // Announce status changes for screen readers
  const live = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (status && live.current) live.current.textContent = t(`sos.status.${status}`)
  }, [status, t])

  if (detail.isError) return <Panel><ErrorState onRetry={() => detail.refetch()} /></Panel>
  if (detail.isPending) return <div className="panel p-6"><Skeleton className="h-8 w-1/3" /><Skeleton className="mt-4 h-72" /></div>

  const { request, towDriver, lastPosition } = detail.data
  const truck = tracking.data?.last ?? lastPosition
  const step = FLOW.indexOf(request.status)
  const eta = tracking.data?.etaMinutes ?? request.etaMinutes
  const canCancel = ['SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'NO_DRIVER'].includes(request.status)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <p ref={live} className="sr-only" aria-live="polite" />
      <Panel bodyClassName="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusChip tone={TOW_TONE[request.status]}>{t(`sos.status.${request.status}`)}</StatusChip>
          {eta != null && ['ASSIGNED', 'EN_ROUTE'].includes(request.status) && (
            <p className="text-sm text-navy-900">
              {t('sos.eta')} <span className="tabular font-stat text-[28px] font-light">{eta}</span> {t('common.min')}
            </p>
          )}
        </div>
        <MapView
          center={{ lat: request.pickupLat, lng: request.pickupLng }}
          pickup={{ lat: request.pickupLat, lng: request.pickupLng }}
          truck={truck && request.status !== 'COMPLETED' ? truck : null}
          trail={tracking.data?.trail}
          className="h-[340px] md:h-[460px]"
          label={t('sos.mapLabel')}
        />
        <p className="text-xs text-navy-600">{t('sos.refreshNote')}</p>
      </Panel>

      <div className="flex flex-col gap-6">
        <Panel title={t('sos.progress')}>
          {request.status === 'NO_DRIVER' ? (
            <div className="rounded-xl bg-danger-subtle p-4 text-sm text-danger">
              <p className="font-medium">{t('sos.noDriverTitle')}</p>
              <p className="mt-1">{t('sos.noDriverBody')}</p>
            </div>
          ) : request.status === 'CANCELLED' ? (
            <p className="text-sm text-navy-600">{t('sos.cancelledBody')}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {FLOW.map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-300', i < step && 'border-success bg-success text-white', i === step && 'border-orange bg-orange text-white', i > step && 'border-grey-200 text-grey-400')}>
                    {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
                  </span>
                  <span className={cn('text-sm', i === step ? 'font-semibold text-navy-900' : i < step ? 'text-navy-900' : 'text-navy-600')}>{t(`sos.status.${s}`)}</span>
                  {i === step && s === 'SEARCHING' && <span className="relative ms-auto size-2 rounded-full bg-orange"><span className="absolute inset-0 animate-pulse-ring rounded-full bg-orange" /></span>}
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {towDriver && (
          <Panel title={t('sos.yourDriver')}>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-night text-white">
                <Truck className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy-900">{towDriver.fullName ?? t('roles.TOW_DRIVER')}</p>
                <p className="text-xs text-navy-600">
                  {towDriver.truckType} · <span dir="ltr">{towDriver.plate}</span>
                </p>
              </div>
            </div>
            {towDriver.phone && (
              <a href={`tel:${towDriver.phone}`} className="pressable mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-orange px-5 text-sm font-medium text-white hover:bg-orange-hover">
                <Phone className="size-4" aria-hidden />
                {t('sos.callDriver')} <span dir="ltr">{formatPhone(towDriver.phone)}</span>
              </a>
            )}
          </Panel>
        )}

        <Panel title={t('sos.requestTitle')}>
          <ListRow
            label={t('sos.trackingCode')}
            value={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 font-semibold text-brand"
                onClick={() => {
                  void navigator.clipboard?.writeText(request.trackingCode)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1500)
                }}
                aria-label={t('common.copy')}
              >
                <span dir="ltr">{request.trackingCode}</span>
                {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              </button>
            }
          />
          {request.pickupAddress && <ListRow label={t('sos.address')} value={request.pickupAddress} />}
          {request.vehicle && <ListRow label={t('mechanics.vehicle')} value={request.vehicle} />}
          {request.issue && <ListRow label={t('sos.issue')} value={request.issue} />}
          {request.estimatedPrice != null && <ListRow label={t('sos.estimatedPrice')} value={formatDZD(request.estimatedPrice)} />}
          <ListRow label={t('sos.payment')} value={t('sos.cashToDriver')} />
          <div className="mt-4 flex flex-wrap gap-3">
            {canCancel && (
              <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
                {t('sos.cancel')}
              </Button>
            )}
            <a href={`tel:${HOTLINE.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline">
              <Phone className="size-4" aria-hidden />
              {t('sos.hotline')}
            </a>
          </div>
        </Panel>
      </div>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={t('sos.cancelTitle')}
        description={t('sos.cancelBody')}
        busy={cancel.isPending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
              {t('common.back')}
            </Button>
            <Button variant="danger" arrow loading={cancel.isPending} onClick={() => cancel.mutate()}>
              {t('sos.cancel')}
            </Button>
          </>
        }
      />
    </div>
  )
}

export function TrackPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { t } = useTranslation()
  return (
    <PageShell title={t('sos.trackTitle')} accent={t('sos.trackAccent')} subtitle={t('sos.trackSubtitle')}>
      <SosTrackingView id={id} code={params.get('code') ?? undefined} />
    </PageShell>
  )
}
