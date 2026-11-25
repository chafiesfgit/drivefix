import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Truck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageShell } from '@/app/layouts/PageShell'
import { s4 } from '@/api'
import type { TowRequest } from '@/api/models'
import { cn } from '@/design/cn'
import { Button, DataTable, EmptyState, ErrorState, ListRow, Modal, Panel, Segmented, StatTile, StatusChip, useToast, type Column } from '@/design/ui'
import { MapView } from '@/design/map/MapView'
import { TOW_TONE } from '@/lib/domain'
import { errorMessage } from '@/lib/errors'
import { formatDateTime, formatDZD, formatRelative } from '@/lib/format'

type BoardRow = TowRequest & { assignedTowDriverName?: string; offersSent?: number }

/** Seed tow drivers, used when S4 has no fleet endpoint yet. */
const SEED_DRIVERS = [
  { userId: '00000000-0000-4000-8000-000000000008', fullName: 'Remorquage Yacine', plate: '00123-116-16', truckType: 'Flatbed' },
  { userId: '00000000-0000-4000-8000-000000000009', fullName: 'Remorquage Amine', plate: '00456-117-16', truckType: 'Hook' },
]

function useFleet() {
  return useQuery({ queryKey: ['fleet'], queryFn: () => s4.fleet(), retry: false, refetchInterval: 10_000, meta: { silent: true } })
}

export function DispatchBoardPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'live' | 'NO_DRIVER' | 'all'>('live')
  const [assigning, setAssigning] = useState<BoardRow | null>(null)
  const [driverId, setDriverId] = useState('')
  const board = useQuery({
    queryKey: ['dispatch', filter],
    queryFn: () =>
      s4.board({ status: filter === 'live' ? 'SEARCHING,NO_DRIVER,ASSIGNED,EN_ROUTE,ARRIVED' : filter === 'NO_DRIVER' ? 'NO_DRIVER' : undefined, page: 1, pageSize: 50 }),
    refetchInterval: 5000,
  })
  const fleet = useFleet()
  const drivers = fleet.data?.items ?? SEED_DRIVERS.map((d) => ({ ...d, available: true, busy: false }))
  const assign = useMutation({
    mutationFn: () => s4.assign(assigning!.id, driverId),
    onSuccess: () => {
      toast.success(t('dispatch.assigned'))
      setAssigning(null)
      void qc.invalidateQueries({ queryKey: ['dispatch'] })
    },
  })
  const rows = (board.data?.items ?? []) as BoardRow[]
  const noDriver = rows.filter((r) => r.status === 'NO_DRIVER').length
  const searching = rows.filter((r) => r.status === 'SEARCHING').length
  const moving = rows.filter((r) => ['ASSIGNED', 'EN_ROUTE'].includes(r.status)).length

  const columns: Column<BoardRow>[] = [
    { key: 'code', header: t('sos.trackingCode'), primary: true, cell: (r) => <span dir="ltr">{r.trackingCode}</span> },
    { key: 'where', header: t('sos.address'), cell: (r) => <span className="line-clamp-2">{r.pickupAddress ?? `${r.pickupLat.toFixed(3)}, ${r.pickupLng.toFixed(3)}`}</span> },
    { key: 'urg', header: t('sos.urgency'), cell: (r) => <StatusChip tone={r.urgency === 'URGENT' ? 'orange' : 'neutral'}>{t(`sos.${r.urgency.toLowerCase()}`)}</StatusChip> },
    { key: 'age', header: t('dispatch.since'), cell: (r) => formatRelative(r.createdAt) },
    { key: 'driver', header: t('roles.TOW_DRIVER'), cell: (r) => r.assignedTowDriverName ?? (r.offersSent ? t('dispatch.offersSent', { count: r.offersSent }) : '—') },
    { key: 'status', header: t('admin.status'), cell: (r) => <StatusChip tone={TOW_TONE[r.status]}>{t(`sos.status.${r.status}`)}</StatusChip> },
    {
      key: 'act',
      header: <span className="sr-only">{t('admin.actions')}</span>,
      className: 'w-[120px] text-end',
      cell: (r) => (['SEARCHING', 'NO_DRIVER'].includes(r.status) ? <Button size="sm" variant={r.status === 'NO_DRIVER' ? 'accent' : 'secondary'} onClick={() => { setDriverId(''); assign.reset(); setAssigning(r) }}>{t('dispatch.assign')}</Button> : null),
    },
  ]

  return (
    <PageShell accent={t('dispatch.title')} subtitle={t('dispatch.subtitle')} wide>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile value={board.isPending ? '…' : noDriver} label={t('sos.status.NO_DRIVER')} className={cn(noDriver > 0 && 'ring-2 ring-danger/40')} />
        <StatTile value={board.isPending ? '…' : searching} label={t('sos.status.SEARCHING')} />
        <StatTile value={board.isPending ? '…' : moving} label={t('dispatch.moving')} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
        <Panel
          title={t('dispatch.requests')}
          actions={<Segmented label={t('admin.status')} value={filter} onChange={setFilter} options={[{ value: 'live', label: t('dispatch.live') }, { value: 'NO_DRIVER', label: t('sos.status.NO_DRIVER'), count: noDriver || undefined }, { value: 'all', label: t('common.all') }]} />}
        >
          {board.isError ? <ErrorState onRetry={() => board.refetch()} description={errorMessage(t, board.error)} /> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} loading={board.isPending} rowClassName={(r) => (r.status === 'NO_DRIVER' ? 'bg-danger-subtle/40' : undefined)} empty={<EmptyState title={t('dispatch.empty')} />} />}
        </Panel>
        <Panel title={t('dispatch.map')} className="self-start">
          <MapView center={{ lat: 36.74, lng: 3.1 }} points={rows.map((r) => ({ id: r.id, lat: r.pickupLat, lng: r.pickupLng }))} fit={false} className="h-[420px]" />
          <p className="mt-2 text-xs text-navy-600">{t('dispatch.refresh')}</p>
        </Panel>
      </div>
      <Modal
        open={Boolean(assigning)}
        onClose={() => setAssigning(null)}
        title={t('dispatch.assignTitle')}
        description={assigning ? `${assigning.trackingCode} · ${assigning.pickupAddress ?? ''}` : undefined}
        busy={assign.isPending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssigning(null)}>{t('common.cancel')}</Button>
            <Button arrow disabled={!driverId} loading={assign.isPending} onClick={() => assign.mutate()}>{t('dispatch.assign')}</Button>
          </>
        }
      >
        {assigning && (
          <>
            <ListRow label={t('sos.issue')} value={assigning.issue ?? '—'} />
            <ListRow label={t('sos.estimatedPrice')} value={assigning.estimatedPrice != null ? formatDZD(assigning.estimatedPrice) : '—'} />
            <ListRow label={t('dispatch.created')} value={formatDateTime(assigning.createdAt)} />
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-medium text-navy-900">{t('dispatch.chooseTruck')}</legend>
              <div className="flex flex-col gap-2">
                {drivers.map((d) => (
                  <label key={d.userId} className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5', driverId === d.userId ? 'border-brand ring-1 ring-brand' : 'border-grey-200', d.busy && 'cursor-not-allowed opacity-50')}>
                    <span className="flex items-center gap-2.5">
                      <input type="radio" name="driver" value={d.userId} disabled={d.busy} checked={driverId === d.userId} onChange={() => setDriverId(d.userId)} className="accent-brand" />
                      <span>
                        <span className="block text-sm font-medium text-navy-900">{d.fullName ?? d.userId.slice(0, 8)}</span>
                        <span className="text-xs text-navy-600">{d.truckType} · <span dir="ltr">{d.plate}</span></span>
                      </span>
                    </span>
                    <StatusChip tone={d.busy ? 'warning' : d.available ? 'success' : 'neutral'}>{d.busy ? t('dispatch.busy') : d.available ? t('tow.online') : t('tow.offline')}</StatusChip>
                  </label>
                ))}
              </div>
            </fieldset>
            {assign.error && <p role="alert" className="mt-3 rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">{errorMessage(t, assign.error)}</p>}
          </>
        )}
      </Modal>
    </PageShell>
  )
}

export function FleetPage() {
  const { t } = useTranslation()
  const fleet = useFleet()
  type Row = { userId: string; fullName?: string; plate?: string; truckType?: string; available?: boolean; busy?: boolean; lat?: number; lng?: number }
  const columns: Column<Row>[] = [
    { key: 'name', header: t('roles.TOW_DRIVER'), primary: true, cell: (d) => <span className="inline-flex items-center gap-2"><Truck className="size-4 text-navy-600" aria-hidden />{d.fullName ?? d.userId.slice(0, 8)}</span> },
    { key: 'plate', header: t('auth.vehiclePlate'), cell: (d) => <span dir="ltr">{d.plate ?? '—'}</span> },
    { key: 'type', header: t('dispatch.truckType'), cell: (d) => d.truckType ?? '—' },
    { key: 'status', header: t('admin.status'), cell: (d) => <StatusChip tone={d.busy ? 'warning' : d.available ? 'success' : 'neutral'}>{d.busy ? t('dispatch.busy') : d.available ? t('tow.online') : t('tow.offline')}</StatusChip> },
  ]
  const rows = fleet.data?.items
  return (
    <PageShell accent={t('dispatch.fleetTitle')} subtitle={t('dispatch.fleetSubtitle')}>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Panel title={t('nav.fleet')}>
          {fleet.isError ? (
            <EmptyState title={t('dispatch.fleetUnavailable')} description={t('dispatch.fleetUnavailableBody')} />
          ) : (
            <DataTable columns={columns} rows={rows} rowKey={(d) => d.userId} loading={fleet.isPending} empty={<EmptyState title={t('dispatch.noTrucks')} />} />
          )}
        </Panel>
        <Panel title={t('dispatch.map')} className="self-start">
          <MapView center={{ lat: 36.74, lng: 3.1 }} points={(rows ?? []).filter((d) => d.lat != null && d.lng != null).map((d) => ({ id: d.userId, lat: d.lat!, lng: d.lng! }))} fit={false} className="h-[380px]" />
        </Panel>
      </div>
    </PageShell>
  )
}
