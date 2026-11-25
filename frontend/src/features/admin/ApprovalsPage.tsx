import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageShell } from '@/app/layouts/PageShell'
import { s1 } from '@/api'
import type { Application } from '@/api/models'
import { Button, DataTable, EmptyState, ErrorState, ListRow, Modal, Pagination, Panel, Segmented, StatusChip, Textarea, TrustBadge, useToast, type Column } from '@/design/ui'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatPhone } from '@/lib/format'
import { wilayaLabel } from '@/lib/wilayas'

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED'
const TONE = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' } as const

export function ApprovalsPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('PENDING')
  const [page, setPage] = useState(1)
  const [review, setReview] = useState<Application | null>(null)
  const [rejecting, setRejecting] = useState<Application | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)

  const list = useQuery({
    queryKey: ['admin', 'applications', tab, page],
    queryFn: () => s1.applications({ status: tab, page, pageSize: 10 }),
    placeholderData: keepPreviousData,
  })
  const pendingCount = useQuery({ queryKey: ['admin', 'applications', 'PENDING', 'count'], queryFn: () => s1.applications({ status: 'PENDING', page: 1, pageSize: 1 }), meta: { silent: true } })

  const done = (msg: string) => {
    toast.success(msg)
    setReview(null)
    setRejecting(null)
    setReason('')
    void qc.invalidateQueries({ queryKey: ['admin'] })
  }
  const approve = useMutation({ mutationFn: (a: Application) => s1.approve(a.id), onSuccess: (a) => done(t('admin.approvedToast', { name: a.businessName ?? a.fullName ?? '' })) })
  const reject = useMutation({
    mutationFn: ({ a, r }: { a: Application; r: string }) => s1.reject(a.id, r),
    onSuccess: (a) => done(t('admin.rejectedToast', { name: a.businessName ?? a.fullName ?? '' })),
  })

  const columns: Column<Application>[] = [
    {
      key: 'name',
      header: t('admin.applicant'),
      primary: true,
      cell: (a) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-navy-900">{a.businessName || a.fullName || '—'}</span>
          {a.fullName && a.businessName && a.fullName !== a.businessName && <span className="block truncate text-xs text-navy-600">{a.fullName}</span>}
        </span>
      ),
    },
    { key: 'role', header: t('admin.role'), cell: (a) => t(`roles.${a.role}`, { defaultValue: a.role }) },
    { key: 'wilaya', header: t('auth.wilaya'), cell: (a) => wilayaLabel(a.wilaya, i18n.language) },
    { key: 'date', header: t('admin.submitted'), cell: (a) => formatDate(a.createdAt) },
    { key: 'status', header: t('admin.status'), cell: (a) => <StatusChip tone={TONE[a.status]}>{t(`admin.appStatus.${a.status}`)}</StatusChip> },
    {
      key: 'actions',
      header: <span className="sr-only">{t('admin.actions')}</span>,
      className: 'w-[230px]',
      cell: (a) =>
        a.status === 'PENDING' ? (
          <span className="flex flex-wrap justify-end gap-2 lg:flex-nowrap" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="primary" icon={<Check className="size-3.5" aria-hidden />} loading={approve.isPending && approve.variables?.id === a.id} onClick={() => approve.mutate(a)}>
              {t('admin.approve')}
            </Button>
            <Button size="sm" variant="secondary" icon={<X className="size-3.5" aria-hidden />} onClick={() => setRejecting(a)}>
              {t('admin.reject')}
            </Button>
          </span>
        ) : (
          <span className="text-xs text-navy-600">{a.reason ?? '—'}</span>
        ),
    },
  ]

  return (
    <PageShell accent={t('admin.approvalsTitle')} subtitle={t('admin.approvalsSubtitle')}>
      <Panel
        title={t(`admin.appStatus.${tab}`)}
        actions={
          <Segmented
            label={t('admin.status')}
            value={tab}
            onChange={(v) => {
              setTab(v)
              setPage(1)
            }}
            options={[
              { value: 'PENDING', label: t('admin.appStatus.PENDING'), count: pendingCount.data?.total },
              { value: 'APPROVED', label: t('admin.appStatus.APPROVED') },
              { value: 'REJECTED', label: t('admin.appStatus.REJECTED') },
            ]}
          />
        }
      >
        {list.isError ? (
          <ErrorState onRetry={() => list.refetch()} description={errorMessage(t, list.error)} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={list.data?.items}
              rowKey={(a) => a.id}
              loading={list.isPending}
              caption={t('admin.approvalsTitle')}
              onRowClick={setReview}
              empty={<EmptyState title={t('admin.noApplications')} description={t('admin.noApplicationsBody')} />}
            />
            {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
          </>
        )}
      </Panel>

      <Modal
        open={Boolean(review)}
        onClose={() => setReview(null)}
        title={t('admin.reviewTitle')}
        description={review ? t(`roles.${review.role}`, { defaultValue: review.role }) : undefined}
        footer={
          review?.status === 'PENDING' && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setRejecting(review)
                  setReview(null)
                }}
              >
                {t('admin.reject')}
              </Button>
              <Button arrow loading={approve.isPending} onClick={() => approve.mutate(review)}>
                {t('admin.approveWithBadge')}
              </Button>
            </>
          )
        }
      >
        {review && (
          <div>
            <TrustBadge state={review.status === 'APPROVED' ? 'verified' : review.status === 'PENDING' ? 'pending' : 'unverified'} label={review.status === 'APPROVED' ? t('admin.badgeIdentity') : undefined} />
            <div className="mt-3">
              <ListRow label={t('auth.fullName')} value={review.fullName ?? '—'} />
              <ListRow label={t('auth.phone')} value={<span dir="ltr">{formatPhone(review.phone)}</span>} />
              <ListRow label={t('auth.businessName')} value={review.businessName ?? '—'} />
              <ListRow label={t('auth.wilaya')} value={wilayaLabel(review.wilaya, i18n.language)} />
              <ListRow label={t('auth.documentNumber')} value={<span dir="ltr">{review.documentNumber ?? '—'}</span>} />
              {review.vehiclePlate && <ListRow label={t('auth.vehiclePlate')} value={<span dir="ltr">{review.vehiclePlate}</span>} />}
              <ListRow label={t('admin.submitted')} value={formatDate(review.createdAt)} />
              {review.reason && <ListRow label={t('admin.reason')} value={review.reason} />}
            </div>
            <p className="mt-4 text-xs text-navy-600">{t('admin.auditNote')}</p>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => {
          setRejecting(null)
          setReasonError(null)
        }}
        title={t('admin.rejectTitle')}
        description={t('admin.rejectBody')}
        busy={reject.isPending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              arrow
              loading={reject.isPending}
              onClick={() => {
                if (reason.trim().length < 5) return setReasonError(t('admin.reasonRequired'))
                setReasonError(null)
                reject.mutate({ a: rejecting!, r: reason.trim() })
              }}
            >
              {t('admin.reject')}
            </Button>
          </>
        }
      >
        <Textarea
          label={t('admin.reason')}
          required
          placeholder={t('admin.reasonPh')}
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          error={reasonError ?? (reject.error ? errorMessage(t, reject.error) : undefined)}
          autoFocus
        />
      </Modal>
    </PageShell>
  )
}
