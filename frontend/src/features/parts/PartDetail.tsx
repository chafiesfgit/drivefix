import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, ShoppingCart, Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '@/app/layouts/PageShell'
import { s2 } from '@/api'
import type { OfferWithSupplier } from '@/api/models'
import { cn } from '@/design/cn'
import { Button, ButtonLink, EmptyState, ErrorState, ListRow, Modal, Panel, Skeleton, StatusChip, Tag, useToast } from '@/design/ui'
import { useAuth } from '@/lib/auth'
import { cart, useCart } from '@/lib/cart'
import { formatDZD } from '@/lib/format'
import { wilayaLabel } from '@/lib/wilayas'
import { PartThumb } from './PartsBrowser'

export function CartButton() {
  const { t } = useTranslation()
  const { count } = useCart()
  const { role } = useAuth()
  if (role !== 'DRIVER') return null
  return (
    <ButtonLink to="/app/driver/cart" variant="white" icon={<ShoppingCart className="size-4" aria-hidden />}>
      {t('nav.cart')}
      {count > 0 && <span className="tabular rounded-full bg-orange px-1.5 text-xs text-white">{count}</span>}
    </ButtonLink>
  )
}

export function PartDetailPage() {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useAuth()
  const inApp = location.pathname.startsWith('/app/')
  const [selected, setSelected] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const { items: cartItems } = useCart()

  const query = useQuery({ queryKey: ['part', id], queryFn: () => s2.part(id) })
  const compare = useMutation({ mutationFn: (ids: string[]) => s2.compare(ids) })

  const add = (o: OfferWithSupplier) => {
    if (role !== 'DRIVER') {
      toast.info(t('parts.signInToOrder'))
      navigate('/login', { state: { from: `/app/driver/parts/${id}` } })
      return
    }
    cart.add({
      offerId: o.id,
      partId: o.partId,
      partName: query.data?.part.name ?? '',
      supplierId: o.supplierId,
      supplierName: o.supplierName,
      price: o.price,
      condition: o.condition,
      stock: o.stock,
    })
    toast.success(t('parts.added'), query.data?.part.name)
  }

  const toggle = (offerId: string) =>
    setSelected((s) => (s.includes(offerId) ? s.filter((x) => x !== offerId) : s.length >= 3 ? s : [...s, offerId]))

  const part = query.data?.part
  const offers = query.data?.offers ?? []
  const best = offers[0]

  return (
    <PageShell
      title={part?.name ?? ' '}
      subtitle={part ? `${part.brand} · ${part.category}` : undefined}
      actions={<CartButton />}
    >
      <Link to={inApp ? '/app/driver/parts' : '/parts'} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {t('parts.backToResults')}
      </Link>
      {query.isError ? (
        <Panel>
          <ErrorState onRetry={() => query.refetch()} />
        </Panel>
      ) : query.isPending ? (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="panel p-6">
            <Skeleton className="h-48" />
            <Skeleton className="mt-4 h-4 w-2/3" />
          </div>
          <div className="panel p-6">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="mt-4 h-12" />
            <Skeleton className="mt-3 h-12" />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <Panel className="self-start">
            <PartThumb category={part?.category} className="h-48" />
            <div className="mt-4">
              <ListRow label={t('parts.brand')} value={part?.brand} />
              <ListRow label={t('parts.reference')} value={<span dir="ltr">{part?.reference ?? '—'}</span>} />
              <ListRow label={t('parts.category')} value={part?.category ? t(`parts.cat.${part.category}`, { defaultValue: part.category }) : '—'} />
            </div>
            {part?.compatibleVehicles?.length ? (
              <div className="mt-4">
                <p className="text-xs text-navy-600">{t('parts.compatible')}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {part.compatibleVehicles.map((v) => (
                    <Tag key={v}>{v}</Tag>
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel
            title={t('parts.offersTitle', { count: offers.length })}
            actions={
              <Button
                variant="secondary"
                size="sm"
                disabled={selected.length < 2}
                onClick={() => {
                  compare.mutate(selected)
                  setCompareOpen(true)
                }}
              >
                {t('parts.compare', { count: selected.length })}
              </Button>
            }
          >
            {offers.length === 0 ? (
              <EmptyState title={t('parts.noOffers')} description={t('parts.noOffersBody')} />
            ) : (
              <>
                <p className="mb-3 text-xs text-navy-600">{t('parts.compareHint')}</p>
                <ul className="flex flex-col gap-3">
                  {offers.map((o) => {
                    const inCart = cartItems.some((c) => c.offerId === o.id)
                    const checked = selected.includes(o.id)
                    return (
                      <li key={o.id} className={cn('rounded-xl border bg-white p-4 transition-colors duration-150', checked ? 'border-brand' : 'border-grey-200')}>
                        <div className="flex flex-wrap items-start gap-4">
                          <label className="mt-1 inline-flex cursor-pointer items-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(o.id)}
                              disabled={!checked && selected.length >= 3}
                              className="size-4 accent-brand"
                              aria-label={t('parts.selectForCompare', { name: o.supplierName ?? '' })}
                            />
                          </label>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-words text-sm font-semibold text-navy-900">{o.supplierName ?? t('parts.supplier')}</p>
                              {o.supplierRating != null && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-navy-600">
                                  <Star className="size-3.5 fill-orange text-orange" aria-hidden />
                                  {o.supplierRating}
                                </span>
                              )}
                              {best?.id === o.id && <StatusChip tone="info">{t('parts.bestPrice')}</StatusChip>}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <StatusChip tone={o.condition === 'NEW' ? 'success' : 'orange'}>{o.condition === 'NEW' ? t('parts.new') : t('parts.used')}</StatusChip>
                              <Tag>{t('parts.warranty', { count: o.warrantyMonths ?? 0 })}</Tag>
                              <Tag>{o.stock > 0 ? t('parts.inStock', { count: o.stock }) : t('parts.outOfStock')}</Tag>
                            </div>
                            {o.deliveryWilayas?.length ? (
                              <p className="mt-2 text-xs text-navy-600">
                                {t('parts.deliversTo')}: {o.deliveryWilayas.slice(0, 4).map((w) => wilayaLabel(w, i18n.language)).join(', ')}
                                {o.deliveryWilayas.length > 4 && ` +${o.deliveryWilayas.length - 4}`}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <p className="tabular text-price font-bold text-navy-900">{formatDZD(o.price)}</p>
                            <Button size="sm" variant={inCart ? 'secondary' : 'accent'} disabled={o.stock < 1} onClick={() => add(o)} icon={inCart ? <Check className="size-4" aria-hidden /> : <ShoppingCart className="size-4" aria-hidden />}>
                              {inCart ? t('parts.addOneMore') : t('parts.addToCart')}
                            </Button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </Panel>
        </div>
      )}

      <Modal open={compareOpen} onClose={() => setCompareOpen(false)} title={t('parts.compareTitle')} size="lg">
        {compare.isPending ? (
          <Skeleton className="h-40" />
        ) : compare.isError ? (
          <ErrorState onRetry={() => compare.mutate(selected)} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {compare.data?.items.map((o) => (
              <div key={o.id} className="rounded-xl border border-grey-200 p-4">
                <p className="break-words text-sm font-semibold text-navy-900">{o.supplierName}</p>
                <p className="tabular mt-2 text-price font-bold text-navy-900">{formatDZD(o.price)}</p>
                <ListRow label={t('parts.condition')} value={o.condition === 'NEW' ? t('parts.new') : t('parts.used')} />
                <ListRow label={t('parts.warrantyLabel')} value={t('parts.warranty', { count: o.warrantyMonths ?? 0 })} />
                <ListRow label={t('parts.rating')} value={o.supplierRating ?? '—'} />
                <ListRow label={t('parts.stock')} value={o.stock} />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </PageShell>
  )
}
