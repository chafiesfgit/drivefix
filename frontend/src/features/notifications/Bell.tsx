import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell as BellIcon, CheckCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { s6 } from '@/api'
import { cn } from '@/design/cn'
import { Popover } from '@/design/ui'
import { formatRelative } from '@/lib/format'

/** Bell with unread badge (polls S6 every 30 s; S6 down never breaks the page). */
export function NotificationBell({ allHref }: { allHref: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const count = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => s6.unreadCount(),
    refetchInterval: 30_000,
    retry: false,
    meta: { silent: true },
  })
  const list = useQuery({
    queryKey: ['notifications', 'latest'],
    queryFn: () => s6.list({ page: 1, pageSize: 6 }),
    retry: false,
    meta: { silent: true },
  })
  const readAll = useMutation({
    mutationFn: () => s6.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const unread = count.data?.count ?? 0

  return (
    <Popover
      label={t('notifications.title')}
      className="w-[min(340px,calc(100vw-32px))]"
      trigger={({ open, toggle, id }) => (
        <button
          type="button"
          onClick={() => {
            toggle()
            if (!open) void list.refetch()
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={id}
          aria-label={unread ? t('notifications.unreadLabel', { count: unread }) : t('notifications.title')}
          className="pressable relative inline-flex size-10 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
        >
          <BellIcon className="size-[18px]" aria-hidden />
          {unread > 0 && (
            <span className="tabular absolute end-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-night">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-grey-200 px-4 py-3">
            <p className="text-sm font-semibold text-navy-900">{t('notifications.title')}</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-brand hover:bg-sand disabled:opacity-40"
              disabled={!unread || readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              <CheckCheck className="size-3.5" aria-hidden />
              {t('notifications.markAll')}
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {list.isError && <li className="px-4 py-6 text-center text-xs text-navy-600">{t('notifications.unavailable')}</li>}
            {list.data?.items.length === 0 && <li className="px-4 py-6 text-center text-xs text-navy-600">{t('notifications.empty')}</li>}
            {list.data?.items.map((n) => (
              <li key={n.id} className={cn('flex gap-3 px-4 py-2.5', !n.read && 'bg-orange/[0.04]')}>
                <span aria-hidden className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-orange')} />
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-navy-900">{n.title}</p>
                  <p className="break-words text-xs text-navy-600">{n.body}</p>
                  <p className="mt-0.5 text-[11px] text-grey-400">{formatRelative(n.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link to={allHref} onClick={close} className="block border-t border-grey-200 px-4 py-3 text-center text-xs font-medium text-brand hover:bg-cream-50">
            {t('notifications.seeAll')}
          </Link>
        </div>
      )}
    </Popover>
  )
}
