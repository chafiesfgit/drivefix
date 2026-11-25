import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageShell } from '@/app/layouts/PageShell'
import { s1 } from '@/api'
import type { User } from '@/api/models'
import { Button, DataTable, EmptyState, ErrorState, Input, Modal, Pagination, Panel, Select, StatusChip, Textarea, useToast, type Column, type Tone } from '@/design/ui'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatPhone } from '@/lib/format'
import { ROLES } from '@/lib/roles'

const STATUS_TONE: Record<User['status'], Tone> = { ACTIVE: 'success', SUSPENDED: 'danger', PENDING_APPROVAL: 'warning', PENDING_OTP: 'neutral' }

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return v
}

export function UsersPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const { claims } = useAuth()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<User | null>(null)
  const [reason, setReason] = useState('')
  const dq = useDebounced(q.trim())

  useEffect(() => setPage(1), [dq, role, status])

  const list = useQuery({
    queryKey: ['admin', 'users', { dq, role, status, page }],
    queryFn: () => s1.users({ q: dq || undefined, role: role || undefined, status: status || undefined, page, pageSize: 10 }),
    placeholderData: keepPreviousData,
  })
  const change = useMutation({
    mutationFn: ({ u, s, r }: { u: User; s: 'ACTIVE' | 'SUSPENDED'; r?: string }) => s1.setUserStatus(u.id, s, r),
    onSuccess: (u) => {
      toast.success(u.status === 'SUSPENDED' ? t('admin.suspendedToast', { name: u.fullName }) : t('admin.reactivatedToast', { name: u.fullName }))
      setTarget(null)
      setReason('')
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  const columns: Column<User>[] = [
    { key: 'name', header: t('auth.fullName'), primary: true, cell: (u) => <span className="block truncate">{u.fullName}</span> },
    { key: 'role', header: t('admin.role'), cell: (u) => t(`roles.${u.role}`) },
    { key: 'phone', header: t('auth.phone'), cell: (u) => <span dir="ltr" className="tabular">{formatPhone(u.phone)}</span> },
    { key: 'joined', header: t('admin.joined'), cell: (u) => formatDate(u.createdAt) },
    { key: 'status', header: t('admin.status'), cell: (u) => <StatusChip tone={STATUS_TONE[u.status]}>{t(`userStatus.${u.status}`)}</StatusChip> },
    {
      key: 'actions',
      header: <span className="sr-only">{t('admin.actions')}</span>,
      className: 'w-[140px] text-end',
      cell: (u) =>
        u.id === claims?.sub ? (
          <span className="text-xs text-navy-600">{t('admin.you')}</span>
        ) : u.status === 'SUSPENDED' ? (
          <Button size="sm" variant="secondary" loading={change.isPending && change.variables?.u.id === u.id} onClick={() => change.mutate({ u, s: 'ACTIVE' })}>
            {t('admin.reactivate')}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => setTarget(u)} disabled={u.status === 'PENDING_OTP'}>
            {t('admin.suspend')}
          </Button>
        ),
    },
  ]

  return (
    <PageShell accent={t('admin.usersTitle')} subtitle={t('admin.usersSubtitle')}>
      <Panel title={t('admin.accounts')}>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_200px_220px]">
          <Input label={t('admin.searchLabel')} placeholder={t('admin.searchPh')} value={q} onChange={(e) => setQ(e.target.value)} leading={<Search className="size-4" aria-hidden />} type="search" />
          <Select label={t('admin.role')} placeholder={t('common.all')} options={ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))} value={role} onChange={(e) => setRole(e.target.value)} />
          <Select
            label={t('admin.status')}
            placeholder={t('common.all')}
            options={(['ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED', 'PENDING_OTP'] as const).map((s) => ({ value: s, label: t(`userStatus.${s}`) }))}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
        </div>
        {list.isError ? (
          <ErrorState onRetry={() => list.refetch()} description={errorMessage(t, list.error)} />
        ) : (
          <div className={list.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <DataTable
              columns={columns}
              rows={list.data?.items}
              rowKey={(u) => u.id}
              loading={list.isPending}
              caption={t('admin.accounts')}
              empty={<EmptyState title={t('admin.noUsers')} description={t('admin.noUsersBody')} />}
            />
            {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
          </div>
        )}
      </Panel>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={t('admin.suspendTitle', { name: target?.fullName ?? '' })}
        description={t('admin.suspendBody')}
        busy={change.isPending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" arrow loading={change.isPending} onClick={() => change.mutate({ u: target!, s: 'SUSPENDED', r: reason.trim() || undefined })}>
              {t('admin.suspend')}
            </Button>
          </>
        }
      >
        <Textarea label={t('admin.reason')} helper={t('common.optional')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Modal>
    </PageShell>
  )
}
