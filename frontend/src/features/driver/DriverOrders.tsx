import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, CreditCard, Minus, Package, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '@/app/layouts/PageShell'
import { s2, s5 } from '@/api'
import type { Order } from '@/api/models'
import { cn } from '@/design/cn'
import { Button, ButtonLink, DataTable, EmptyState, ErrorState, Input, ListRow, Modal, Panel, Segmented, Select, Skeleton, StatusChip, type Column } from '@/design/ui'
import { ReviewModal } from '@/features/common/Rating'
import { cart, useCart } from '@/lib/cart'
import { ORDER_TONE } from '@/lib/domain'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatDZD, shortId } from '@/lib/format'
import { wilayaLabel, wilayaOptions } from '@/lib/wilayas'

/** Same table as the S2 seed (delivery_fees); the server total is the one that counts. */
const FEES: Record<string, number> = { '16': 500, '09': 600, '35': 600, '31': 900 }
const feeFor = (w: string) => FEES[w] ?? 1200


export function CartPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { items, subtotal } = useCart()
  const [address, setAddress] = useState('')
  const [wilaya, setWilaya] = useState('16')
  const [method, setMethod] = useState<'CASH' | 'SANDBOX'>('CASH')
  const [touched, setTouched] = useState(false)

  const place = useMutation({
    mutationFn: () => s2.placeOrder({ items: items.map((i) => ({ offerId: i.offerId, qty: i.qty })), deliveryAddress: address.trim(), wilaya, paymentMethod: method }),
    meta: { silent: true },
    onSuccess: (order) => {
      cart.clear()
      void qc.invalidateQueries({ queryKey: ['orders'] })
      if (order.paymentMethod === 'SANDBOX' && order.payUrl) {
        const url = new URL(order.payUrl, window.location.origin)
        if (url.origin === window.location.origin) navigate(url.pathname)
        else window.location.assign(order.payUrl)
      } else navigate(`/app/driver/orders/${order.id}`, { state: { placed: true } })
    },
  })

  const fee = feeFor(wilaya)
  const addressError = touched && address.trim().length < 6 ? t('cart.addressRequired') : undefined

  return (
    <PageShell title={t('cart.title')} accent={t('cart.accent')} subtitle={t('cart.subtitle')}>
      {items.length === 0 ? (
        <Panel>
          <EmptyState icon={<Package className="size-5" aria-hidden />} title={t('cart.empty')} description={t('cart.emptyBody')} action={<ButtonLink to="/app/driver/parts" arrow>{t('landing.searchParts')}</ButtonLink>} />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <Panel title={t('cart.items', { count: items.length })}>
            <ul className="flex flex-col divide-y divide-grey-200/70">
              {items.map((i) => (
                <li key={i.offerId} className="flex flex-wrap items-center gap-4 py-4 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-navy-900">{i.partName}</p>
                    <p className="text-xs text-navy-600">
                      {i.supplierName} · <StatusChip tone={i.condition === 'NEW' ? 'success' : 'orange'} className="ms-1 align-middle">{i.condition === 'NEW' ? t('parts.new') : t('parts.used')}</StatusChip>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-grey-200 bg-white p-1" role="group" aria-label={t('cart.quantity')}>
                    <button type="button" className="pressable inline-flex size-8 items-center justify-center rounded-full hover:bg-sand disabled:opacity-40" disabled={i.qty <= 1} onClick={() => cart.setQty(i.offerId, i.qty - 1)} aria-label={t('cart.decrease')}>
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <span className="tabular w-6 text-center text-sm font-medium" aria-live="polite">{i.qty}</span>
                    <button type="button" className="pressable inline-flex size-8 items-center justify-center rounded-full hover:bg-sand disabled:opacity-40" disabled={i.qty >= i.stock} onClick={() => cart.setQty(i.offerId, i.qty + 1)} aria-label={t('cart.increase')}>
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </div>
                  <p className="tabular w-28 text-end text-sm font-semibold text-navy-900">{formatDZD(i.price * i.qty)}</p>
                  <button type="button" onClick={() => cart.remove(i.offerId)} className="pressable inline-flex size-9 items-center justify-center rounded-full text-navy-600 hover:bg-danger-subtle hover:text-danger" aria-label={t('cart.remove', { name: i.partName })}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={t('cart.checkout')} className="self-start">
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                setTouched(true)
                if (address.trim().length >= 6) place.mutate()
              }}
              className="flex flex-col gap-4"
            >
              <Input label={t('cart.address')} placeholder={t('cart.addressPh')} required value={address} onChange={(e) => setAddress(e.target.value)} error={addressError} autoComplete="street-address" />
              <Select label={t('auth.wilaya')} options={wilayaOptions(i18n.language)} value={wilaya} onChange={(e) => setWilaya(e.target.value)} />
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-navy-900">{t('cart.payment')}</legend>
                <div className="flex flex-col gap-2">
                  {(['CASH', 'SANDBOX'] as const).map((m) => (
                    <label key={m} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3 transition-colors', method === m ? 'border-brand ring-1 ring-brand' : 'border-grey-200')}>
                      <input type="radio" name="method" className="mt-1 accent-brand" checked={method === m} onChange={() => setMethod(m)} />
                      <span>
                        <span className="block text-sm font-medium text-navy-900">{t(`payments.method.${m}`)}</span>
                        <span className="text-xs text-navy-600">{t(`cart.method${m}`)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="rounded-xl bg-cream-100 p-3">
                <ListRow label={t('cart.subtotal')} value={formatDZD(subtotal)} />
                <ListRow label={t('cart.delivery', { wilaya: wilayaLabel(wilaya, i18n.language) })} value={formatDZD(fee)} />
                <ListRow label={<span className="font-semibold text-navy-900">{t('cart.total')}</span>} value={<span className="text-price font-bold">{formatDZD(subtotal + fee)}</span>} />
                <p className="mt-1 text-xs text-navy-600">{t('cart.totalNote')}</p>
              </div>
              {place.error && <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">{errorMessage(t, place.error)}</p>}
              <Button type="submit" variant="accent" arrow size="lg" loading={place.isPending} icon={method === 'SANDBOX' ? <CreditCard className="size-4" aria-hidden /> : undefined}>
                {method === 'SANDBOX' ? t('cart.payOnline') : t('cart.placeOrder')}
              </Button>
            </form>
          </Panel>
        </div>
      )}
    </PageShell>
  )
}

export function OrdersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const q = useQuery({ queryKey: ['orders', status], queryFn: () => s2.orders({ status: status || undefined, page: 1, pageSize: 50 }) })
  const columns: Column<Order>[] = [
    { key: 'id', header: t('orders.order'), primary: true, cell: (o) => <span dir="ltr">#{shortId(o.id)}</span> },
    { key: 'items', header: t('orders.items'), cell: (o) => <span className="line-clamp-1">{o.items.map((i) => i.partName ?? '—').join(', ')}</span> },
    { key: 'date', header: t('admin.date'), cell: (o) => formatDate(o.createdAt) },
    { key: 'total', header: t('cart.total'), cell: (o) => <span className="tabular">{formatDZD(o.total)}</span> },
    { key: 'status', header: t('admin.status'), cell: (o) => <StatusChip tone={ORDER_TONE[o.status]}>{t(`orders.status.${o.status}`)}</StatusChip> },
  ]
  return (
    <PageShell accent={t('orders.title')} subtitle={t('orders.subtitle')}>
      <Panel
        title={t('orders.history')}
        actions={<Segmented label={t('admin.status')} value={status} onChange={setStatus} options={[{ value: '', label: t('common.all') }, ...(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const).map((s) => ({ value: s, label: t(`orders.status.${s}`) }))]} />}
      >
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} description={errorMessage(t, q.error)} />
        ) : (
          <DataTable columns={columns} rows={q.data?.items} rowKey={(o) => o.id} loading={q.isPending} onRowClick={(o) => navigate(`/app/driver/orders/${o.id}`)} empty={<EmptyState title={t('orders.empty')} action={<ButtonLink to="/app/driver/parts" arrow>{t('landing.searchParts')}</ButtonLink>} />} />
        )}
      </Panel>
    </PageShell>
  )
}

const FLOW: Order['status'][] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED']

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const q = useQuery({ queryKey: ['order', id], queryFn: () => s2.order(id), refetchInterval: 10_000 })
  const pay = useQuery({ queryKey: ['payment', id], queryFn: () => s5.payments({ refId: id, page: 1, pageSize: 1 }), meta: { silent: true }, refetchInterval: 10_000 })
  const cancel = useMutation({
    mutationFn: () => s2.setOrderStatus(id, 'CANCELLED', 'Cancelled by driver'),
    onSuccess: () => {
      setCancelOpen(false)
      void qc.invalidateQueries({ queryKey: ['order', id] })
    },
  })
  const review = useMutation({
    mutationFn: ({ r, c }: { r: number; c?: string }) => s2.reviewOrder(id, r, c),
    meta: { silent: true },
    onSuccess: () => {
      setReviewOpen(false)
      void qc.invalidateQueries({ queryKey: ['order', id] })
    },
  })
  const o = q.data
  const payment = pay.data?.items[0]
  // v1.1: the sandbox link comes from S2 (order.payUrl) or S5 (payment.payUrl), whichever service has it.
  const payUrl = q.data?.payUrl ?? payment?.payUrl
  const needsPay = q.data?.paymentMethod === 'SANDBOX' && q.data.status === 'PENDING' && payment?.status !== 'PAID'
  const step = o ? FLOW.indexOf(o.status) : -1
  const subtotal = o ? o.items.reduce((s, i) => s + i.qty * i.unitPrice, 0) : 0

  return (
    <PageShell accent={o ? t('orders.orderN', { id: shortId(o.id) }) : t('orders.title')} subtitle={o ? formatDate(o.createdAt) : undefined}>
      <Link to="/app/driver/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {t('orders.back')}
      </Link>
      {q.isError ? (
        <Panel><ErrorState onRetry={() => q.refetch()} description={errorMessage(t, q.error)} /></Panel>
      ) : !o ? (
        <div className="panel p-6"><Skeleton className="h-6 w-1/3" /><Skeleton className="mt-4 h-40" /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-6">
            <Panel title={t('orders.tracking')}>
              {o.status === 'CANCELLED' ? (
                <StatusChip tone="neutral">{t('orders.status.CANCELLED')}</StatusChip>
              ) : (
                <ol className="grid grid-cols-4 gap-2">
                  {FLOW.map((s, i) => (
                    <li key={s} className="flex flex-col items-center gap-2 text-center">
                      <span className={cn('flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-300', i < step && 'border-success bg-success text-white', i === step && 'border-orange bg-orange text-white', i > step && 'border-grey-200 text-grey-400')}>
                        {i < step ? <Check className="size-4" aria-hidden /> : i + 1}
                      </span>
                      <span className={cn('text-xs', i <= step ? 'font-medium text-navy-900' : 'text-navy-600')}>{t(`orders.status.${s}`)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel title={t('orders.items')}>
              {o.items.map((i) => (
                <ListRow key={i.offerId} label={`${i.partName ?? '—'} × ${i.qty}${i.supplierName ? ` · ${i.supplierName}` : ''}`} value={formatDZD(i.unitPrice * i.qty)} />
              ))}
              <ListRow label={t('cart.subtotal')} value={formatDZD(subtotal)} />
              <ListRow label={t('cart.deliveryShort')} value={formatDZD(o.deliveryFee)} />
              <ListRow label={<span className="font-semibold text-navy-900">{t('cart.total')}</span>} value={<span className="text-price font-bold">{formatDZD(o.total)}</span>} />
            </Panel>
          </div>
          <div className="flex flex-col gap-6">
            <Panel title={t('orders.delivery')}>
              <ListRow label={t('cart.address')} value={o.deliveryAddress} />
              <ListRow label={t('auth.wilaya')} value={wilayaLabel(o.wilaya, i18n.language)} />
              <ListRow label={t('cart.payment')} value={t(`payments.method.${o.paymentMethod}`)} />
              {payment && <ListRow label={t('orders.paymentStatus')} value={<StatusChip tone={payment.status === 'PAID' ? 'success' : payment.status === 'FAILED' ? 'danger' : 'warning'}>{t(`payments.status.${payment.status}`)}</StatusChip>} />}
              <div className="mt-4 flex flex-wrap gap-3">
                {needsPay && payUrl && (
                  <ButtonLink to={new URL(payUrl, window.location.origin).pathname} variant="accent" arrow>
                    {t('orders.payNow')}
                  </ButtonLink>
                )}
                {needsPay && !payUrl && (
                  <p role="status" className="flex w-full flex-wrap items-center gap-3 rounded-lg bg-warning-subtle px-3 py-2 text-sm text-warning">
                    {t('orders.payLinkMissing')}
                    <Button size="sm" variant="secondary" onClick={() => { void q.refetch(); void pay.refetch() }}>
                      {t('common.retry')}
                    </Button>
                  </p>
                )}
                {o.status === 'PENDING' && (
                  <Button variant="secondary" onClick={() => setCancelOpen(true)}>
                    {t('orders.cancel')}
                  </Button>
                )}
                {o.status === 'DELIVERED' && (
                  <Button arrow onClick={() => setReviewOpen(true)}>
                    {t('orders.rate')}
                  </Button>
                )}
              </div>
              {review.isSuccess && <p role="status" className="mt-3 text-xs text-success">{t('reviews.thanks')}</p>}
            </Panel>
          </div>
        </div>
      )}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={t('orders.cancelTitle')}
        description={t('orders.cancelBody')}
        busy={cancel.isPending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>{t('common.back')}</Button>
            <Button variant="danger" arrow loading={cancel.isPending} onClick={() => cancel.mutate()}>{t('orders.cancel')}</Button>
          </>
        }
      />
      <ReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} title={t('orders.rate')} busy={review.isPending} error={review.error ? errorMessage(t, review.error) : undefined} onSubmit={(r, c) => review.mutate({ r, c })} />
    </PageShell>
  )
}
