import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, MessageSquareText, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageShell } from '@/app/layouts/PageShell'
import { s1, s2, s4, s5, s6 } from '@/api'
import type { Payment } from '@/api/models'
import { Button, ButtonLink, DataTable, EmptyState, ErrorState, Input, Modal, Panel, Segmented, StatTile, StatusChip, Textarea, useToast, type Column, type Tone } from '@/design/ui'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatDateTime, formatDZD, formatPhone, shortId } from '@/lib/format'

const PAY_TONE: Record<Payment['status'], Tone> = { PENDING: 'warning', PAID: 'success', FAILED: 'danger', REFUNDED: 'neutral' }

export function AdminOverviewPage() {
  const { t } = useTranslation()
  const pending = useQuery({ queryKey: ['admin', 'applications', 'PENDING', 'count'], queryFn: () => s1.applications({ status: 'PENDING', page: 1, pageSize: 1 }) })
  const users = useQuery({ queryKey: ['admin', 'users', 'count'], queryFn: () => s1.users({ page: 1, pageSize: 1 }) })
  const suspended = useQuery({ queryKey: ['admin', 'users', 'suspended'], queryFn: () => s1.users({ status: 'SUSPENDED', page: 1, pageSize: 1 }) })
  const tows = useQuery({ queryKey: ['admin', 'tows'], queryFn: () => s4.board({ page: 1, pageSize: 100 }), meta: { silent: true } })
  const payments = useQuery({ queryKey: ['admin', 'payments', 'all'], queryFn: () => s5.payments({ page: 1, pageSize: 100 }), meta: { silent: true } })
  const v = (n: number | undefined, loading: boolean) => (loading ? '…' : n ?? '—')
  const noDriver = tows.data?.items.filter((x) => x.status === 'NO_DRIVER').length ?? 0
  const activeTows = tows.data?.items.filter((x) => ['SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED'].includes(x.status)).length
  const paid = payments.data?.items.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)

  return (
    <PageShell accent={t('admin.overviewTitle')} subtitle={t('admin.overviewSubtitle')}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile value={v(pending.data?.total, pending.isPending)} label={t('admin.statPending')} />
        <StatTile value={v(users.data?.total, users.isPending)} label={t('admin.statUsers')} />
        <StatTile value={v(activeTows, tows.isPending)} label={t('admin.statTows')} />
        <StatTile value={paid != null ? formatDZD(paid) : '—'} label={t('admin.statPaid')} />
      </div>
      <Panel title={t('admin.needsAttention')} className="mt-6">
        <ul className="flex flex-col gap-3">
          <li className="flex flex-wrap items-center justify-between gap-3">
            <StatusChip tone={(pending.data?.total ?? 0) > 0 ? 'warning' : 'success'}>{t('admin.attnApplications', { count: pending.data?.total ?? 0 })}</StatusChip>
            <ButtonLink to="/app/admin/approvals" size="sm" variant="secondary">{t('admin.open')}</ButtonLink>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3">
            <StatusChip tone={noDriver > 0 ? 'danger' : 'success'}>{t('admin.attnNoDriver', { count: noDriver })}</StatusChip>
            <ButtonLink to="/app/admin/fleet" size="sm" variant="secondary">{t('admin.open')}</ButtonLink>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3">
            <StatusChip tone={(suspended.data?.total ?? 0) > 0 ? 'info' : 'neutral'}>{t('admin.attnSuspended', { count: suspended.data?.total ?? 0 })}</StatusChip>
            <ButtonLink to="/app/admin/users" size="sm" variant="secondary">{t('admin.open')}</ButtonLink>
          </li>
        </ul>
      </Panel>
    </PageShell>
  )
}

/** Review and listing moderation (Figma 54/55). The contract has no moderation endpoint yet: actions are local. */
export function ModerationPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [tab, setTab] = useState<'listings' | 'reviews'>('listings')
  const [hidden, setHidden] = useState<string[]>([])
  const parts = useQuery({ queryKey: ['parts', 'moderation'], queryFn: () => s2.parts({ page: 1, pageSize: 50 }) })
  type Row = { id: string; name: string; brand: string; category: string; minPrice?: number; hasUsed?: boolean }
  const rows = (parts.data?.items as Row[] | undefined)?.filter((r) => !hidden.includes(r.id))
  const columns: Column<Row>[] = [
    { key: 'name', header: t('admin.part'), primary: true, cell: (r) => <Link className="hover:underline" to={`/parts/${r.id}`}>{r.name}</Link> },
    { key: 'brand', header: t('parts.brand'), cell: (r) => r.brand },
    { key: 'cond', header: t('parts.condition'), cell: (r) => (r.hasUsed ? <StatusChip tone="orange">{t('parts.used')}</StatusChip> : <StatusChip tone="success">{t('parts.new')}</StatusChip>) },
    { key: 'price', header: t('admin.price'), cell: (r) => (r.minPrice != null ? formatDZD(r.minPrice) : '—') },
    {
      key: 'act',
      header: <span className="sr-only">{t('admin.actions')}</span>,
      className: 'w-[140px] text-end',
      cell: (r) => (
        <Button size="sm" variant="ghost" className="text-danger" onClick={() => { setHidden((h) => [...h, r.id]); toast.info(t('admin.hiddenToast'), t('admin.demoAction')) }}>
          {t('admin.hide')}
        </Button>
      ),
    },
  ]
  return (
    <PageShell accent={t('admin.moderationTitle')} subtitle={t('admin.moderationSubtitle')}>
      <Panel
        title={tab === 'listings' ? t('admin.listingsToCheck') : t('admin.flaggedReviews')}
        actions={<Segmented label={t('admin.moderationTitle')} value={tab} onChange={setTab} options={[{ value: 'listings', label: t('admin.listings') }, { value: 'reviews', label: t('nav.reviews') }]} />}
      >
        {tab === 'listings' ? (
          parts.isError ? <ErrorState onRetry={() => parts.refetch()} /> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} loading={parts.isPending} empty={<EmptyState title={t('admin.nothingToModerate')} />} />
        ) : (
          <EmptyState icon={<MessageSquareText className="size-5" aria-hidden />} title={t('admin.noFlagged')} description={t('admin.noFlaggedBody')} />
        )}
      </Panel>
    </PageShell>
  )
}

export function AdminPaymentsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [refunding, setRefunding] = useState<Payment | null>(null)
  const [reason, setReason] = useState('')
  const list = useQuery({ queryKey: ['admin', 'payments', status], queryFn: () => s5.payments({ status: status || undefined, page: 1, pageSize: 50 }) })
  const refund = useMutation({
    mutationFn: () => s5.refund(refunding!.id, reason.trim()),
    onSuccess: () => {
      toast.success(t('admin.refundedToast'))
      setRefunding(null)
      setReason('')
      void qc.invalidateQueries({ queryKey: ['admin', 'payments'] })
    },
  })
  const columns: Column<Payment>[] = [
    { key: 'ref', header: t('admin.reference'), primary: true, cell: (p) => <span dir="ltr">{p.refType} #{shortId(p.refId)}</span> },
    { key: 'amount', header: t('payments.amount'), cell: (p) => <span className="tabular">{formatDZD(p.amount)}</span> },
    { key: 'method', header: t('admin.method'), cell: (p) => t(`payments.method.${p.method}`) },
    { key: 'date', header: t('admin.date'), cell: (p) => formatDate(p.createdAt) },
    { key: 'status', header: t('admin.status'), cell: (p) => <StatusChip tone={PAY_TONE[p.status]}>{t(`payments.status.${p.status}`)}</StatusChip> },
    { key: 'act', header: <span className="sr-only">{t('admin.actions')}</span>, className: 'w-[120px] text-end', cell: (p) => p.status === 'PAID' ? <Button size="sm" variant="secondary" onClick={() => setRefunding(p)}>{t('admin.refund')}</Button> : null },
  ]
  return (
    <PageShell accent={t('admin.paymentsTitle')} subtitle={t('admin.paymentsSubtitle')}>
      <Panel
        title={t('admin.paymentsTitle')}
        actions={
          <Segmented label={t('admin.status')} value={status} onChange={setStatus} options={[{ value: '', label: t('common.all') }, ...(['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const).map((s) => ({ value: s, label: t(`payments.status.${s}`) }))]} />
        }
      >
        {list.isError ? <ErrorState onRetry={() => list.refetch()} description={errorMessage(t, list.error)} /> : <DataTable columns={columns} rows={list.data?.items} rowKey={(p) => p.id} loading={list.isPending} empty={<EmptyState title={t('admin.noPayments')} />} />}
      </Panel>
      <Modal
        open={Boolean(refunding)}
        onClose={() => setRefunding(null)}
        title={t('admin.refundTitle')}
        description={refunding ? formatDZD(refunding.amount) : undefined}
        busy={refund.isPending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefunding(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" arrow disabled={reason.trim().length < 5} loading={refund.isPending} onClick={() => refund.mutate()}>{t('admin.refund')}</Button>
          </>
        }
      >
        <Textarea label={t('admin.reason')} required value={reason} onChange={(e) => setReason(e.target.value)} helper={t('admin.reasonRequired')} />
      </Modal>
    </PageShell>
  )
}

export function SmsLogPage() {
  const { t } = useTranslation()
  const log = useQuery({ queryKey: ['admin', 'sms'], queryFn: () => s6.smsLog({ page: 1, pageSize: 50 }), refetchInterval: 5000 })
  type Sms = { id: string; phone: string; text: string; status: string; createdAt: string }
  const columns: Column<Sms>[] = [
    { key: 'phone', header: t('auth.phone'), primary: true, cell: (s) => <span dir="ltr" className="tabular">{formatPhone(s.phone)}</span> },
    { key: 'text', header: t('admin.message'), className: 'w-1/2', cell: (s) => <span className="break-words font-mono text-xs text-navy-900">{s.text}</span> },
    { key: 'status', header: t('admin.status'), cell: (s) => <StatusChip tone="success">{s.status}</StatusChip> },
    { key: 'at', header: t('admin.date'), cell: (s) => formatDateTime(s.createdAt) },
  ]
  return (
    <PageShell accent={t('admin.smsTitle')} subtitle={t('admin.smsSubtitle')}>
      <Panel title={t('admin.smsTitle')}>
        {log.isError ? <ErrorState onRetry={() => log.refetch()} description={errorMessage(t, log.error)} /> : <DataTable columns={columns} rows={log.data?.items} rowKey={(s) => s.id} loading={log.isPending} empty={<EmptyState title={t('admin.noSms')} description={t('admin.noSmsBody')} />} />}
      </Panel>
    </PageShell>
  )
}

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export function ReportsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const users = useQuery({ queryKey: ['admin', 'users', 'count'], queryFn: () => s1.users({ page: 1, pageSize: 1 }) })
  const orders = useQuery({ queryKey: ['admin', 'orders'], queryFn: () => s2.orders({ page: 1, pageSize: 100 }), meta: { silent: true } })
  const tows = useQuery({ queryKey: ['admin', 'tows'], queryFn: () => s4.board({ page: 1, pageSize: 100 }), meta: { silent: true } })
  const run = async (kind: 'users' | 'payments') => {
    setBusy(kind)
    try {
      if (kind === 'users') {
        const r = await s1.users({ page: 1, pageSize: 100 })
        downloadCsv('drivefix-users.csv', [['id', 'fullName', 'phone', 'role', 'status', 'createdAt'], ...r.items.map((u) => [u.id, u.fullName, u.phone, u.role, u.status, u.createdAt])])
      } else {
        const r = await s5.payments({ page: 1, pageSize: 100 })
        downloadCsv('drivefix-payments.csv', [['id', 'refType', 'refId', 'amount', 'method', 'status', 'createdAt'], ...r.items.map((p) => [p.id, p.refType, p.refId, p.amount, p.method, p.status, p.createdAt])])
      }
    } catch (e) {
      toast.error(errorMessage(t, e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <PageShell accent={t('admin.reportsTitle')} subtitle={t('admin.reportsSubtitle')}>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile value={users.data?.total ?? '—'} label={t('admin.statUsers')} />
        <StatTile value={orders.data?.total ?? '—'} label={t('admin.statOrders')} />
        <StatTile value={tows.data?.total ?? '—'} label={t('admin.statTowsTotal')} />
      </div>
      <Panel title={t('admin.export')} className="mt-6">
        <p className="text-sm text-navy-600">{t('admin.exportBody')}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} loading={busy === 'users'} onClick={() => run('users')}>{t('admin.exportUsers')}</Button>
          <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} loading={busy === 'payments'} onClick={() => run('payments')}>{t('admin.exportPayments')}</Button>
        </div>
      </Panel>
    </PageShell>
  )
}

/** Figma 58: business rules. They live in each service's .env; this screen documents them (read-only in V2). */
export function SettingsPage() {
  const { t } = useTranslation()
  const rules = [
    { label: t('admin.ruleOtp'), value: '5 min · 5' },
    { label: t('admin.ruleLock'), value: '5 → 15 min' },
    { label: t('admin.ruleOffer'), value: '30 s · 3' },
    { label: t('admin.ruleTowFee'), value: `${formatDZD(3000)} + ${formatDZD(120)}/km` },
    { label: t('admin.ruleCancel'), value: '2 h' },
  ]
  return (
    <PageShell accent={t('admin.settingsTitle')} subtitle={t('admin.settingsSubtitle')}>
      <Panel title={t('admin.businessRules')} className="max-w-3xl">
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-info-subtle px-3 py-2 text-xs text-info">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('admin.settingsNote')}
        </p>
        <div className="grid gap-4">
          {rules.map((r) => (
            <Input key={r.label} label={r.label} value={r.value} readOnly disabled />
          ))}
        </div>
      </Panel>
    </PageShell>
  )
}
