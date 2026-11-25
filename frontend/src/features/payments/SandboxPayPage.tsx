import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, FlaskConical, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { PageShell } from '@/app/layouts/PageShell'
import { s5 } from '@/api'
import { Button, ButtonLink, ErrorState, ListRow, Panel, Skeleton } from '@/design/ui'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/errors'
import { formatDateTime, formatDZD } from '@/lib/format'

/** Figma 80: fake payment provider page (S5 sandbox). */
export function SandboxPayPage() {
  const { token = '' } = useParams()
  const { t } = useTranslation()
  const { role } = useAuth()
  const session = useQuery({ queryKey: ['pay', token], queryFn: () => s5.session(token), retry: false })
  const succeed = useMutation({ mutationFn: () => s5.succeed(token), meta: { silent: true } })
  const fail = useMutation({ mutationFn: () => s5.fail(token), meta: { silent: true } })
  const result = succeed.data ?? fail.data
  const error = succeed.error ?? fail.error
  const back = role === 'DRIVER' ? '/app/driver/orders' : '/'

  return (
    <PageShell title={t('payments.title')} accent={t('payments.accent')} subtitle={t('payments.subtitle')}>
      <Panel className="max-w-[480px]">
        <p className="mb-5 flex items-center gap-2 rounded-lg bg-warning-subtle px-3 py-2 text-xs font-medium text-warning">
          <FlaskConical className="size-4 shrink-0" aria-hidden />
          {t('payments.demoBanner')}
        </p>
        {session.isPending ? (
          <Skeleton className="h-32" />
        ) : session.isError ? (
          <ErrorState description={errorMessage(t, session.error)} onRetry={() => session.refetch()} />
        ) : result ? (
          <div className="flex flex-col items-start gap-3" role="status">
            {result.status === 'PAID' ? <CheckCircle2 className="size-10 text-success" aria-hidden /> : <XCircle className="size-10 text-danger" aria-hidden />}
            <h2 className="text-h2 font-semibold text-navy-900">{result.status === 'PAID' ? t('payments.paid') : t('payments.failed')}</h2>
            <p className="text-sm text-navy-600">{result.status === 'PAID' ? t('payments.paidBody') : t('payments.failedBody')}</p>
            <ButtonLink to={back} arrow className="mt-2">
              {t('payments.backToOrders')}
            </ButtonLink>
          </div>
        ) : (
          <>
            <p className="tabular font-stat text-[48px] font-light leading-none text-navy-900">{formatDZD(session.data.amount)}</p>
            <div className="mt-5">
              <ListRow label={t('payments.label')} value={session.data.label} />
              <ListRow label={t('payments.expires')} value={formatDateTime(session.data.expiresAt)} />
            </div>
            {error && <p role="alert" className="mt-4 rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">{errorMessage(t, error)}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button arrow loading={succeed.isPending} disabled={fail.isPending} onClick={() => succeed.mutate()}>
                {t('payments.succeed')}
              </Button>
              <Button variant="danger" loading={fail.isPending} disabled={succeed.isPending} onClick={() => fail.mutate()}>
                {t('payments.fail')}
              </Button>
            </div>
          </>
        )}
      </Panel>
    </PageShell>
  )
}
