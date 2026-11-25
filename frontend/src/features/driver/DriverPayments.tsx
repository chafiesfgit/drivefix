import { useQuery } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageShell } from '@/app/layouts/PageShell'
import { s5 } from '@/api'
import type { Payment } from '@/api/models'
import { DataTable, EmptyState, ErrorState, Pagination, Panel, Segmented, StatusChip, type Column } from '@/design/ui'
import { errorMessage } from '@/lib/errors'
import { formatDateTime, formatDZD, shortId } from '@/lib/format'

type Filter = 'all' | Payment['status']

const TONE: Record<Payment['status'], 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  PAID: 'success',
  FAILED: 'danger',
  REFUNDED: 'neutral',
}

/** Driver payment history (S5 GET /payments): orders and tows, newest first. */
export function DriverPaymentsPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const q = useQuery({
    queryKey: ['payments', 'mine', status, page],
    queryFn: () => s5.payments({ status: status === 'all' ? undefined : status, page, pageSize: 20 }),
  })

  const columns: Column<Payment>[] = [
    { key: 'date', header: t('payments.date'), cell: (p) => formatDateTime(p.createdAt) },
    {
      key: 'what',
      header: t('payments.what'),
      primary: true,
      cell: (p) =>
        p.refType === 'ORDER' ? (
          <Link to={`/app/driver/orders/${p.refId}`} className="font-medium text-brand hover:underline">
            {t('payments.forOrder', { ref: shortId(p.refId) })}
          </Link>
        ) : (
          <Link to={`/app/driver/sos/${p.refId}`} className="font-medium text-brand hover:underline">
            {t('payments.forTow', { ref: shortId(p.refId) })}
          </Link>
        ),
    },
    { key: 'amount', header: t('payments.amount'), className: 'tabular', cell: (p) => formatDZD(p.amount) },
    { key: 'method', header: t('admin.method'), cell: (p) => t(`payments.method.${p.method}`) },
    { key: 'status', header: t('admin.status'), cell: (p) => <StatusChip tone={TONE[p.status] ?? 'neutral'}>{t(`payments.status.${p.status}`)}</StatusChip> },
  ]

  return (
    <PageShell accent={t('nav.payments')} subtitle={t('payments.historySubtitle')}>
      <Panel
        title={t('payments.historyTitle')}
        actions={
          <Segmented<Filter>
            label={t('admin.status')}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'PENDING', label: t('payments.status.PENDING') },
              { value: 'PAID', label: t('payments.status.PAID') },
              { value: 'FAILED', label: t('payments.status.FAILED') },
              { value: 'REFUNDED', label: t('payments.status.REFUNDED') },
            ]}
          />
        }
      >
        {q.isError ? (
          <ErrorState description={errorMessage(t, q.error)} onRetry={() => q.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={q.data?.items}
              rowKey={(p) => p.id}
              loading={q.isPending}
              empty={<EmptyState icon={<Receipt className="size-5" aria-hidden />} title={t('payments.historyEmpty')} description={t('payments.historyEmptyBody')} />}
            />
            {q.data && <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
          </>
        )}
      </Panel>
    </PageShell>
  )
}
