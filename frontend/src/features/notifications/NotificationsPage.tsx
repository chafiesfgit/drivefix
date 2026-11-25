import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageShell } from '@/app/layouts/PageShell'
import { s6 } from '@/api'
import { cn } from '@/design/cn'
import { Button, EmptyState, ErrorState, Pagination, Panel, Segmented, SkeletonRows } from '@/design/ui'
import { formatDateTime } from '@/lib/format'

export function NotificationsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [page, setPage] = useState(1)
  const q = useQuery({ queryKey: ['notifications', 'list', tab, page], queryFn: () => s6.list({ unread: tab === 'unread' || undefined, page, pageSize: 20 }) })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] })
  const read = useMutation({ mutationFn: (id: string) => s6.markRead(id), onSuccess: invalidate })
  const readAll = useMutation({ mutationFn: () => s6.markAllRead(), onSuccess: invalidate })
  return (
    <PageShell accent={t('notifications.title')} subtitle={t('notifications.subtitle')}>
      <Panel
        title={t('notifications.title')}
        actions={
          <>
            <Segmented label={t('notifications.title')} value={tab} onChange={(v) => { setTab(v); setPage(1) }} options={[{ value: 'all', label: t('common.all') }, { value: 'unread', label: t('notifications.unread') }]} />
            <Button size="sm" variant="secondary" icon={<CheckCheck className="size-4" aria-hidden />} loading={readAll.isPending} onClick={() => readAll.mutate()}>{t('notifications.markAll')}</Button>
          </>
        }
      >
        {q.isError ? (
          <ErrorState title={t('notifications.unavailable')} onRetry={() => q.refetch()} />
        ) : q.isPending ? (
          <SkeletonRows />
        ) : q.data.items.length === 0 ? (
          <EmptyState icon={<Bell className="size-5" aria-hidden />} title={t('notifications.empty')} />
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-grey-200/70">
              {q.data.items.map((n) => (
                <li key={n.id} className={cn('flex items-start gap-3 py-3', !n.read && 'bg-orange/[0.03]')}>
                  <span aria-hidden className={cn('mt-2 size-2 shrink-0 rounded-full', n.read ? 'bg-grey-200' : 'bg-orange')} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-navy-900">{n.title}</p>
                    <p className="break-words text-sm text-navy-600">{n.body}</p>
                    <p className="mt-1 text-xs text-grey-400">{formatDateTime(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <Button size="sm" variant="ghost" onClick={() => read.mutate(n.id)}>{t('notifications.markRead')}</Button>
                  )}
                </li>
              ))}
            </ul>
            <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </PageShell>
  )
}
