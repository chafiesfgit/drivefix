import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Battery, Cog, Disc3, Filter, Flame, Search, Wrench, Zap } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { s2 } from '@/api'
import type { Part } from '@/api/models'
import { cn } from '@/design/cn'
import { Button, EmptyState, ErrorState, Input, Pagination, Panel, Select, Skeleton, StatusChip } from '@/design/ui'
import { CATEGORIES } from '@/lib/domain'
import { formatDZD } from '@/lib/format'


const ICONS: Record<string, typeof Cog> = {
  Brakes: Disc3,
  Filters: Filter,
  Ignition: Flame,
  Engine: Cog,
  Electrical: Zap,
  Suspension: Wrench,
  Battery: Battery,
}

type PartRow = Part & { minPrice?: number; offersCount?: number; hasUsed?: boolean }

export function PartThumb({ category, className }: { category?: string; className?: string }) {
  const Icon = ICONS[category ?? ''] ?? Cog
  return (
    <div className={cn('flex items-center justify-center rounded-lg bg-sand text-grey-400', className)}>
      <Icon className="size-10" strokeWidth={1.25} aria-hidden />
    </div>
  )
}

function PartCard({ part, to }: { part: PartRow; to: string }) {
  const { t } = useTranslation()
  return (
    <Link
      to={to}
      className="group flex h-full flex-col rounded-card border border-grey-200 bg-white/80 p-3 shadow-[0_12px_32px_-18px_rgb(8_26_59/0.25)] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-panel"
    >
      <PartThumb category={part.category} className="h-32" />
      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusChip tone="success">{t('parts.new')}</StatusChip>
        {part.hasUsed && <StatusChip tone="orange">{t('parts.usedAvailable')}</StatusChip>}
      </div>
      <h3 className="mt-2 line-clamp-2 break-words text-h3 font-semibold text-navy-900">{part.name}</h3>
      <p className="mt-1 truncate text-xs text-navy-600">
        {part.brand}
        {part.reference && <> · <span dir="ltr">{part.reference}</span></>}
      </p>
      {part.compatibleVehicles?.length ? <p className="mt-1 truncate text-xs text-grey-400">{part.compatibleVehicles.join(', ')}</p> : null}
      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        {part.minPrice != null ? (
          <p className="text-price font-bold text-navy-900">
            <span className="me-1 text-xs font-normal text-navy-600">{t('parts.from')}</span>
            <span className="tabular">{formatDZD(part.minPrice)}</span>
          </p>
        ) : (
          <p className="text-sm text-navy-600">{t('parts.seeOffers')}</p>
        )}
        {part.offersCount != null && <span className="shrink-0 text-xs text-navy-600">{t('parts.offersCount', { count: part.offersCount })}</span>}
      </div>
    </Link>
  )
}

/** Search form + result grid. Filters live in the URL so the page can be shared and reloaded. */
export function PartsBrowser({ basePath }: { basePath: string }) {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const vehicle = params.get('vehicle') ?? ''
  const category = params.get('category') ?? ''
  const page = Number(params.get('page') ?? 1) || 1
  const [draft, setDraft] = useState({ q, vehicle, category })

  const query = useQuery({
    queryKey: ['parts', { q, vehicle, category, page }],
    queryFn: () => s2.parts({ q: q || undefined, vehicle: vehicle || undefined, category: category || undefined, page, pageSize: 12 }),
    placeholderData: keepPreviousData,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = new URLSearchParams()
    if (draft.q.trim()) next.set('q', draft.q.trim())
    if (draft.vehicle.trim()) next.set('vehicle', draft.vehicle.trim())
    if (draft.category) next.set('category', draft.category)
    setParams(next)
  }

  const items = query.data?.items as PartRow[] | undefined

  return (
    <div className="flex flex-col gap-6">
      <Panel title={t('parts.findTitle')}>
        <form role="search" onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_1fr_220px_auto] md:items-start">
          <Input label={t('landing.vehicle')} placeholder={t('landing.vehiclePh')} helper={t('landing.vehicleHelp')} value={draft.vehicle} onChange={(e) => setDraft((d) => ({ ...d, vehicle: e.target.value }))} />
          <Input label={t('landing.part')} placeholder={t('landing.partPh')} helper={t('landing.partHelp')} value={draft.q} onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))} />
          <Select
            label={t('parts.category')}
            placeholder={t('common.all')}
            options={CATEGORIES.map((c) => ({ value: c, label: t(`parts.cat.${c}`) }))}
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
          />
          <div className="md:pt-6">
            <Button type="submit" arrow icon={<Search className="size-4" aria-hidden />}>
              {t('landing.searchParts')}
            </Button>
          </div>
        </form>
      </Panel>

      {query.isError ? (
        <Panel>
          <ErrorState onRetry={() => query.refetch()} />
        </Panel>
      ) : query.isPending ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label={t('common.loading')}>
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="rounded-card border border-grey-200 bg-white p-3">
              <Skeleton className="h-32" />
              <Skeleton className="mt-3 h-4 w-1/3" />
              <Skeleton className="mt-2 h-4 w-4/5" />
              <Skeleton className="mt-6 h-5 w-1/2" />
            </li>
          ))}
        </ul>
      ) : items && items.length === 0 ? (
        <Panel>
          <EmptyState title={t('parts.noResults')} description={t('parts.noResultsBody')} action={<Button variant="secondary" onClick={() => { setDraft({ q: '', vehicle: '', category: '' }); setParams(new URLSearchParams()) }}>{t('parts.clearFilters')}</Button>} />
        </Panel>
      ) : (
        <>
          <p className="text-sm text-navy-600" aria-live="polite">
            {t('parts.resultsCount', { count: query.data?.total ?? 0 })}
          </p>
          <ul className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4 transition-opacity duration-200', query.isPlaceholderData && 'opacity-60')}>
            {items?.map((p) => (
              <li key={p.id}>
                <PartCard part={p} to={`${basePath}/${p.id}`} />
              </li>
            ))}
          </ul>
          {query.data && (
            <Pagination
              page={query.data.page}
              pageSize={query.data.pageSize}
              total={query.data.total}
              onPage={(p) => {
                const next = new URLSearchParams(params)
                next.set('page', String(p))
                setParams(next)
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
