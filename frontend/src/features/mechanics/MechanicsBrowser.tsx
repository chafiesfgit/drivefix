import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Home, MapPin, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { s3 } from '@/api'
import type { MechanicProfile } from '@/api/models'
import { Checkbox, EmptyState, ErrorState, Pagination, Panel, Select, Skeleton, Tag, TrustBadge } from '@/design/ui'
import { MapView } from '@/design/map/MapView'
import { SPECIALTIES } from '@/lib/domain'
import { wilayaLabel, wilayaOptions } from '@/lib/wilayas'


export function Rating({ value, count }: { value?: number; count?: number }) {
  const { t } = useTranslation()
  if (value == null) return <span className="text-xs text-navy-600">{t('mechanics.noRating')}</span>
  return (
    <span className="inline-flex items-center gap-1 text-sm text-navy-900" aria-label={t('mechanics.ratingLabel', { value })}>
      <Star className="size-4 fill-orange text-orange" aria-hidden />
      <span className="tabular font-semibold">{value.toFixed(1)}</span>
      {count != null && <span className="text-xs text-navy-600">({count})</span>}
    </span>
  )
}

function MechanicCard({ m, to }: { m: MechanicProfile; to: string }) {
  const { t, i18n } = useTranslation()
  return (
    <Link to={to} className="group flex h-full flex-col rounded-card border border-grey-200 bg-white p-5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-h3 font-semibold text-navy-900">{m.garageName}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-navy-600">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{m.address ? `${m.address} · ` : ''}{wilayaLabel(m.wilaya, i18n.language)}</span>
          </p>
        </div>
        <Rating value={m.rating} count={m.reviewsCount} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {m.specialties?.map((s) => (
          <Tag key={s}>{t(`mechanics.spec.${s}`, { defaultValue: s })}</Tag>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <TrustBadge state="verified" label={t('mechanics.verifiedBadge')} />
        {m.offersMobile && (
          <span className="inline-flex items-center gap-1 rounded-full bg-info-subtle px-2 py-1 text-xs font-medium text-info">
            <Home className="size-3.5" aria-hidden />
            {t('mechanics.atYourPlace')}
          </span>
        )}
      </div>
    </Link>
  )
}

export function MechanicsBrowser({ basePath }: { basePath: string }) {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const wilaya = params.get('wilaya') ?? ''
  const specialty = params.get('specialty') ?? ''
  const atClient = params.get('atClient') === 'true'
  const page = Number(params.get('page') ?? 1) || 1
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    next.delete('page')
    setParams(next)
  }
  const query = useQuery({
    queryKey: ['mechanics', { wilaya, specialty, atClient, page }],
    queryFn: () => s3.mechanics({ wilaya: wilaya || undefined, specialty: specialty || undefined, atClient: atClient || undefined, page, pageSize: 12 }),
    placeholderData: keepPreviousData,
  })
  const items = query.data?.items ?? []
  const points = items.filter((m) => m.lat != null && m.lng != null).map((m) => ({ id: m.userId, lat: m.lat!, lng: m.lng! }))

  return (
    <div className="flex flex-col gap-6">
      <Panel title={t('mechanics.filters')}>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Select label={t('auth.wilaya')} placeholder={t('common.all')} options={wilayaOptions(i18n.language)} value={wilaya} onChange={(e) => set('wilaya', e.target.value)} />
          <Select
            label={t('mechanics.specialty')}
            placeholder={t('common.all')}
            options={SPECIALTIES.map((s) => ({ value: s, label: t(`mechanics.spec.${s}`) }))}
            value={specialty}
            onChange={(e) => set('specialty', e.target.value)}
          />
          <Checkbox label={t('mechanics.atYourPlace')} checked={atClient} onChange={(e) => set('atClient', e.target.checked ? 'true' : null)} className="pb-2" />
        </div>
      </Panel>
      {query.isError ? (
        <Panel>
          <ErrorState onRetry={() => query.refetch()} />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div>
            {query.isPending ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <li key={i} className="rounded-card border border-grey-200 bg-white p-5">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                    <Skeleton className="mt-6 h-6 w-1/3 rounded-full" />
                  </li>
                ))}
              </ul>
            ) : items.length === 0 ? (
              <Panel>
                <EmptyState title={t('mechanics.empty')} description={t('mechanics.emptyBody')} />
              </Panel>
            ) : (
              <>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {items.map((m) => (
                    <li key={m.userId}>
                      <MechanicCard m={m} to={`${basePath}/${m.userId}`} />
                    </li>
                  ))}
                </ul>
                {query.data && <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={(p) => set('page', String(p))} />}
              </>
            )}
          </div>
          <MapView center={{ lat: 36.75, lng: 3.2 }} points={points} fit={false} className="h-[320px] lg:sticky lg:top-6 lg:h-[460px]" label={t('mechanics.mapLabel')} />
        </div>
      )}
    </div>
  )
}
