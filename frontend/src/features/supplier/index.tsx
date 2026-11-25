import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageShell } from '@/app/layouts/PageShell'
import { s2, s5 } from '@/api'
import { isApiError } from '@/api/http'
import type { Offer, Order, Part } from '@/api/models'
import { cn } from '@/design/cn'
import { Button, ButtonLink, Checkbox, DataTable, EmptyState, ErrorState, Input, ListRow, Modal, Panel, Segmented, Select, StatTile, StatusChip, Textarea, useToast, type Column } from '@/design/ui'
import { useAuth } from '@/lib/auth'
import { ORDER_TONE } from '@/lib/domain'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatDZD, shortId } from '@/lib/format'
import { WILAYAS, wilayaLabel } from '@/lib/wilayas'

type OfferRow = Offer & { part?: Part }
type OrderRow = Order & { driverName?: string }


export function SupplierDashboard() {
  const { t } = useTranslation()
  const offers = useQuery({ queryKey: ['offers'], queryFn: () => s2.myOffers({ page: 1, pageSize: 100 }) })
  const orders = useQuery({ queryKey: ['orders', 'supplier'], queryFn: () => s2.orders({ page: 1, pageSize: 100 }) })
  const pending = orders.data?.items.filter((o) => o.status === 'PENDING') ?? []
  const low = offers.data?.items.filter((o) => o.active && o.stock <= 3) ?? []
  const revenue = orders.data?.items.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + o.total - o.deliveryFee, 0) ?? 0
  return (
    <PageShell accent={t('supplier.dashTitle')} subtitle={t('supplier.dashSubtitle')} actions={<ButtonLink to="/app/supplier/offers" variant="white" arrow>{t('supplier.manageOffers')}</ButtonLink>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile value={orders.isPending ? '…' : pending.length} label={t('supplier.toConfirm')} />
        <StatTile value={offers.isPending ? '…' : offers.data?.items.filter((o) => o.active).length ?? 0} label={t('supplier.activeOffers')} />
        <StatTile value={offers.isPending ? '…' : low.length} label={t('supplier.lowStock')} />
        <StatTile value={formatDZD(revenue)} label={t('supplier.delivered')} />
      </div>
      <Panel title={t('supplier.toConfirm')} className="mt-6" actions={<ButtonLink to="/app/supplier/orders" size="sm" variant="ghost">{t('common.seeAll')}</ButtonLink>}>
        {orders.isError ? <ErrorState onRetry={() => orders.refetch()} /> : pending.length === 0 ? <EmptyState title={t('supplier.noPending')} className="py-6" /> : (
          pending.slice(0, 5).map((o) => <ListRow key={o.id} label={`#${shortId(o.id)} · ${o.items.map((i) => i.partName).join(', ')}`} value={formatDZD(o.total)} />)
        )}
      </Panel>
    </PageShell>
  )
}

function OfferModal({ open, onClose, offer }: { open: boolean; onClose: () => void; offer?: OfferRow | null }) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const editing = Boolean(offer)
  const parts = useQuery({ queryKey: ['parts', 'all'], queryFn: () => s2.parts({ page: 1, pageSize: 100 }), enabled: open && !editing })
  const [partId, setPartId] = useState(offer?.partId ?? '')
  const [price, setPrice] = useState(offer ? String(offer.price) : '')
  const [stock, setStock] = useState(offer ? String(offer.stock) : '')
  const [condition, setCondition] = useState<'NEW' | 'USED'>(offer?.condition ?? 'NEW')
  const [warranty, setWarranty] = useState(String(offer?.warrantyMonths ?? 6))
  const [wilayas, setWilayas] = useState<string[]>(offer?.deliveryWilayas ?? ['16'])
  const [touched, setTouched] = useState(false)
  const int = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : NaN)
  const errors = {
    partId: !editing && !partId ? t('validation.required') : undefined,
    price: !(int(price) > 0) ? t('validation.positiveInt') : undefined,
    stock: !(int(stock) >= 0) ? t('validation.positiveInt') : undefined,
  }
  const valid = !errors.partId && !errors.price && !errors.stock
  const save = useMutation({
    mutationFn: () =>
      editing
        ? s2.updateOffer(offer!.id, { price: int(price), stock: int(stock), warrantyMonths: int(warranty) || 0 })
        : s2.createOffer({ partId, price: int(price), stock: int(stock), condition, warrantyMonths: int(warranty) || 0, deliveryWilayas: wilayas }),
    meta: { silent: true },
    onSuccess: () => {
      toast.success(editing ? t('supplier.offerUpdated') : t('supplier.offerCreated'))
      void qc.invalidateQueries({ queryKey: ['offers'] })
      onClose()
    },
  })
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? t('supplier.editOffer') : t('supplier.addOffer')}
      description={editing ? offer?.part?.name : t('supplier.addOfferBody')}
      busy={save.isPending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button arrow loading={save.isPending} onClick={() => { setTouched(true); if (valid) save.mutate() }}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!editing && (
          <Select
            containerClassName="sm:col-span-2"
            label={t('admin.part')}
            required
            placeholder={parts.isPending ? t('common.loading') : '—'}
            options={(parts.data?.items ?? []).map((p) => ({ value: p.id, label: `${p.name} · ${p.brand}${p.reference ? ` (${p.reference})` : ''}` }))}
            value={partId}
            onChange={(e) => setPartId(e.target.value)}
            error={touched ? errors.partId : undefined}
          />
        )}
        <Input label={t('supplier.priceDzd')} inputMode="numeric" required value={price} onChange={(e) => setPrice(e.target.value)} error={touched ? errors.price : undefined} />
        <Input label={t('parts.stock')} inputMode="numeric" required value={stock} onChange={(e) => setStock(e.target.value)} error={touched ? errors.stock : undefined} />
        {!editing && (
          <Select label={t('parts.condition')} options={[{ value: 'NEW', label: t('parts.new') }, { value: 'USED', label: t('parts.used') }]} value={condition} onChange={(e) => setCondition(e.target.value as 'NEW' | 'USED')} helper={condition === 'USED' ? t('supplier.usedNote') : undefined} />
        )}
        <Input label={t('supplier.warrantyMonths')} inputMode="numeric" value={warranty} onChange={(e) => setWarranty(e.target.value)} />
        {!editing && (
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium text-navy-900">{t('supplier.deliveryWilayas')}</legend>
            <div className="grid max-h-44 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-lg border border-grey-200 bg-white p-3 sm:grid-cols-3">
              {WILAYAS.map((w) => (
                <Checkbox key={w.code} label={wilayaLabel(w.code, i18n.language)} checked={wilayas.includes(w.code)} onChange={(e) => setWilayas((s) => (e.target.checked ? [...s, w.code] : s.filter((x) => x !== w.code)))} />
              ))}
            </div>
          </fieldset>
        )}
      </div>
      {save.error && <p role="alert" className="mt-4 rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">{errorMessage(t, save.error)}</p>}
    </Modal>
  )
}

export function OffersPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; offer?: OfferRow | null }>({ open: false })
  const [deleting, setDeleting] = useState<OfferRow | null>(null)
  const q = useQuery({ queryKey: ['offers'], queryFn: () => s2.myOffers({ page: 1, pageSize: 100 }) })
  const toggle = useMutation({
    mutationFn: (o: OfferRow) => s2.updateOffer(o.id, { active: !o.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offers'] }),
  })
  const del = useMutation({
    mutationFn: (o: OfferRow) => s2.deleteOffer(o.id),
    meta: { silent: true },
    onSuccess: () => {
      toast.success(t('supplier.offerDeleted'))
      setDeleting(null)
      void qc.invalidateQueries({ queryKey: ['offers'] })
    },
  })
  const columns: Column<OfferRow>[] = [
    { key: 'part', header: t('admin.part'), primary: true, cell: (o) => <span>{o.part?.name ?? o.partId.slice(0, 8)}<span className="block text-xs font-normal text-navy-600">{o.part?.brand}</span></span> },
    { key: 'cond', header: t('parts.condition'), cell: (o) => <StatusChip tone={o.condition === 'NEW' ? 'success' : 'orange'}>{o.condition === 'NEW' ? t('parts.new') : t('parts.used')}</StatusChip> },
    { key: 'price', header: t('admin.price'), cell: (o) => <span className="tabular">{formatDZD(o.price)}</span> },
    { key: 'stock', header: t('parts.stock'), cell: (o) => <span className={cn('tabular', o.stock <= 3 && 'font-semibold text-warning')}>{o.stock}</span> },
    { key: 'active', header: t('admin.status'), cell: (o) => <button type="button" onClick={() => toggle.mutate(o)} className="rounded-full" aria-label={o.active ? t('supplier.deactivate') : t('supplier.activate')}><StatusChip tone={o.active ? 'success' : 'neutral'}>{o.active ? t('supplier.active') : t('supplier.inactive')}</StatusChip></button> },
    {
      key: 'act',
      header: <span className="sr-only">{t('admin.actions')}</span>,
      className: 'w-[180px] text-end',
      cell: (o) => (
        <span className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setModal({ open: true, offer: o })}>{t('common.edit')}</Button>
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => { del.reset(); setDeleting(o) }}>{t('common.delete')}</Button>
        </span>
      ),
    },
  ]
  const conflict = del.error && isApiError(del.error) && del.error.code === 'STATE_CONFLICT'
  return (
    <PageShell accent={t('supplier.offersTitle')} subtitle={t('supplier.offersSubtitle')} actions={<Button variant="white" icon={<Plus className="size-4" aria-hidden />} onClick={() => setModal({ open: true, offer: null })}>{t('supplier.addOffer')}</Button>}>
      <Panel title={t('supplier.yourOffers')}>
        {q.isError ? <ErrorState onRetry={() => q.refetch()} description={errorMessage(t, q.error)} /> : <DataTable columns={columns} rows={q.data?.items} rowKey={(o) => o.id} loading={q.isPending} empty={<EmptyState title={t('supplier.noOffers')} action={<Button onClick={() => setModal({ open: true, offer: null })} arrow>{t('supplier.addOffer')}</Button>} />} />}
      </Panel>
      {modal.open && <OfferModal open onClose={() => setModal({ open: false })} offer={modal.offer} />}
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t('supplier.deleteTitle')}
        description={deleting?.part?.name}
        busy={del.isPending}
        footer={
          conflict ? (
            <Button arrow onClick={() => { toggle.mutate({ ...deleting!, active: true }); setDeleting(null) }}>{t('supplier.deactivate')}</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
              <Button variant="danger" arrow loading={del.isPending} onClick={() => del.mutate(deleting!)}>{t('common.delete')}</Button>
            </>
          )
        }
      >
        {del.error && <p role="alert" className="rounded-lg bg-warning-subtle px-3 py-2 text-xs text-warning">{conflict ? t('supplier.inOpenOrder') : errorMessage(t, del.error)}</p>}
      </Modal>
    </PageShell>
  )
}

export function SupplierOrdersPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState<OrderRow | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const q = useQuery({ queryKey: ['orders', 'supplier', status], queryFn: () => s2.orders({ status: status || undefined, page: 1, pageSize: 50 }), refetchInterval: 15_000 })
  const pay = useQuery({ queryKey: ['payment', open?.id], queryFn: () => s5.payments({ refId: open!.id, page: 1, pageSize: 1 }), enabled: Boolean(open), meta: { silent: true } })
  const move = useMutation({
    mutationFn: ({ o, to, reason }: { o: OrderRow; to: 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; reason?: string }) => s2.setOrderStatus(o.id, to, reason),
    onSuccess: (o) => {
      toast.success(t('supplier.orderMoved', { status: t(`orders.status.${o.status}`) }))
      setOpen((cur) => (cur ? { ...cur, ...o } : cur))
      setCancelling(false)
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['offers'] })
    },
  })
  const collect = useMutation({
    mutationFn: (id: string) => s5.cashCollected(id),
    onSuccess: () => {
      toast.success(t('supplier.cashCollected'))
      void pay.refetch()
    },
  })
  const next = (o: OrderRow) => ({ PENDING: 'CONFIRMED', CONFIRMED: 'SHIPPED', SHIPPED: 'DELIVERED' } as const)[o.status as 'PENDING' | 'CONFIRMED' | 'SHIPPED']
  const columns: Column<OrderRow>[] = [
    { key: 'id', header: t('orders.order'), primary: true, cell: (o) => <span dir="ltr">#{shortId(o.id)}</span> },
    { key: 'items', header: t('orders.items'), cell: (o) => <span className="line-clamp-1">{o.items.map((i) => `${i.partName ?? '—'} ×${i.qty}`).join(', ')}</span> },
    { key: 'client', header: t('supplier.client'), cell: (o) => o.driverName ?? '—' },
    { key: 'pay', header: t('cart.payment'), cell: (o) => t(`payments.method.${o.paymentMethod}`) },
    { key: 'status', header: t('admin.status'), cell: (o) => <StatusChip tone={ORDER_TONE[o.status]}>{t(`orders.status.${o.status}`)}</StatusChip> },
  ]
  const payment = pay.data?.items[0]
  return (
    <PageShell accent={t('supplier.ordersTitle')} subtitle={t('supplier.ordersSubtitle')}>
      <Panel
        title={t('supplier.ordersTitle')}
        actions={<Segmented label={t('admin.status')} value={status} onChange={setStatus} options={[{ value: '', label: t('common.all') }, ...(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const).map((s) => ({ value: s, label: t(`orders.status.${s}`) }))]} />}
      >
        {q.isError ? <ErrorState onRetry={() => q.refetch()} description={errorMessage(t, q.error)} /> : <DataTable columns={columns} rows={q.data?.items} rowKey={(o) => o.id} loading={q.isPending} onRowClick={(o) => { setOpen(o); setCancelling(false) }} empty={<EmptyState title={t('supplier.noOrders')} />} />}
      </Panel>
      <Modal
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        size="lg"
        title={open ? t('orders.orderN', { id: shortId(open.id) }) : ''}
        description={open ? formatDate(open.createdAt) : undefined}
        busy={move.isPending}
        footer={
          open && (
            cancelling ? (
              <>
                <Button variant="ghost" onClick={() => setCancelling(false)}>{t('common.back')}</Button>
                <Button variant="danger" arrow disabled={cancelReason.trim().length < 3} loading={move.isPending} onClick={() => move.mutate({ o: open, to: 'CANCELLED', reason: cancelReason.trim() })}>{t('orders.cancel')}</Button>
              </>
            ) : (
              <>
                {['PENDING', 'CONFIRMED'].includes(open.status) && <Button variant="secondary" onClick={() => setCancelling(true)}>{t('orders.cancel')}</Button>}
                {open.paymentMethod === 'CASH' && open.status === 'DELIVERED' && payment?.status === 'PENDING' && (
                  <Button variant="accent" loading={collect.isPending} onClick={() => collect.mutate(payment.id)}>{t('supplier.markCash')}</Button>
                )}
                {next(open) && <Button arrow loading={move.isPending} onClick={() => move.mutate({ o: open, to: next(open)! })}>{t(`supplier.to.${next(open)}`)}</Button>}
              </>
            )
          )
        }
      >
        {open && (
          <div>
            <StatusChip tone={ORDER_TONE[open.status]}>{t(`orders.status.${open.status}`)}</StatusChip>
            <div className="mt-3">
              {open.items.map((i) => <ListRow key={i.offerId} label={`${i.partName ?? '—'} × ${i.qty}`} value={formatDZD(i.unitPrice * i.qty)} />)}
              <ListRow label={t('supplier.client')} value={open.driverName ?? '—'} />
              <ListRow label={t('cart.address')} value={`${open.deliveryAddress} · ${wilayaLabel(open.wilaya, i18n.language)}`} />
              <ListRow label={t('cart.payment')} value={t(`payments.method.${open.paymentMethod}`)} />
              {payment && <ListRow label={t('orders.paymentStatus')} value={t(`payments.status.${payment.status}`)} />}
              <ListRow label={t('cart.total')} value={formatDZD(open.total)} />
            </div>
            {cancelling && <Textarea containerClassName="mt-4" label={t('admin.reason')} required value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus />}
          </div>
        )}
      </Modal>
    </PageShell>
  )
}

export function SupplierReviewsPage() {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const q = useQuery({ queryKey: ['reviews', claims?.sub], queryFn: () => s2.supplierReviews(claims!.sub), enabled: Boolean(claims) })
  return (
    <PageShell accent={t('nav.reviews')} subtitle={t('supplier.reviewsSubtitle')}>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="panel self-start p-6">
          <p className="flex items-center gap-2 font-stat text-[56px] font-light leading-none text-navy-900">
            {q.data ? q.data.average.toFixed(1) : '—'}
            <Star className="size-7 fill-orange text-orange" aria-hidden />
          </p>
          <p className="mt-3 text-sm text-navy-600">{t('supplier.reviewsCount', { count: q.data?.items.length ?? 0 })}</p>
        </div>
        <Panel title={t('nav.reviews')}>
          {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : q.data?.items.length === 0 ? <EmptyState title={t('mechanics.noReviews')} /> : (
            <ul className="flex flex-col gap-4">
              {q.data?.items.map((r) => (
                <li key={r.id} className="border-b border-grey-200/70 pb-4 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold"><Star className="size-4 fill-orange text-orange" aria-hidden />{r.rating}</span>
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
