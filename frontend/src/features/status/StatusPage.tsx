import { useQueries } from '@tanstack/react-query'
import { Copy, RotateCcw } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { PageShell } from '@/app/layouts/PageShell'
import { pingHealth, type HealthResult } from '@/api/http'
import { Button, DataTable, Panel, StatusChip, useToast, type Column } from '@/design/ui'
import { isMocked, mocksEnabled, SERVICE_IDS, SERVICE_NAMES, serviceUrl, type ServiceId } from '@/lib/env'
import { formatDateTime } from '@/lib/format'

type Row = { id: ServiceId; health?: HealthResult; checkedAt?: number; lastError?: { text: string; at: number } }

/** The .env lines that reproduce the current setup (to share with a teammate or paste back later). */
function envLines(): string {
  return [
    ...SERVICE_IDS.map((id) => `VITE_${id.toUpperCase()}_URL=${serviceUrl(id)}`),
    `VITE_USE_MOCKS=${mocksEnabled}`,
    ...SERVICE_IDS.map((id) => `VITE_MOCK_${id.toUpperCase()}=${isMocked(id)}`),
  ].join('\n')
}

/** Public /status: which services are real or mocked, and whether each one answers right now. */
export function StatusPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const lastErrors = useRef<Partial<Record<ServiceId, { text: string; at: number }>>>({})
  const results = useQueries({
    queries: SERVICE_IDS.map((id) => ({
      queryKey: ['status', id],
      queryFn: async () => {
        const h = await pingHealth(id)
        if (!h.ok) lastErrors.current[id] = { text: h.error ?? 'unreachable', at: Date.now() }
        return h
      },
      refetchInterval: 10_000,
      meta: { silent: true },
    })),
  })
  const rows: Row[] = SERVICE_IDS.map((id, i) => ({ id, health: results[i].data, checkedAt: results[i].dataUpdatedAt || undefined, lastError: lastErrors.current[id] }))
  const up = rows.filter((r) => r.health?.ok).length

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(envLines())
      toast.success(t('status.copied'))
    } catch {
      toast.error(t('status.copyFailed'))
    }
  }
  const reset = () => {
    for (const k of ['df.mockdb', 'df.cart', 'df.towJob', 'df.towHistory', 'df.towOnline', 'df.activeTow']) {
      try {
        localStorage.removeItem(k)
      } catch {
        /* storage blocked: nothing to clear */
      }
    }
    window.location.reload()
  }

  const columns: Column<Row>[] = [
    { key: 'name', header: t('status.service'), primary: true, cell: (r) => <span className="font-medium">{`${r.id.toUpperCase()} ${SERVICE_NAMES[r.id]}`}</span> },
    { key: 'mode', header: t('status.mode'), cell: (r) => <StatusChip tone={isMocked(r.id) ? 'neutral' : 'info'}>{isMocked(r.id) ? t('status.mock') : t('status.real')}</StatusChip> },
    { key: 'url', header: t('status.url'), cell: (r) => <code dir="ltr" className="break-all text-xs text-navy-600">{serviceUrl(r.id)}</code> },
    {
      key: 'health',
      header: t('status.health'),
      cell: (r) =>
        !r.health ? (
          <span className="text-xs text-navy-600">{t('status.checking')}</span>
        ) : (
          <StatusChip tone={r.health.ok ? 'success' : 'danger'}>
            {r.health.ok ? t('status.up', { ms: r.health.ms }) : t('status.down')}
          </StatusChip>
        ),
    },
    {
      key: 'error',
      header: t('status.lastError'),
      cell: (r) =>
        r.lastError ? (
          <span className="text-xs text-navy-600">
            <span dir="ltr">{r.lastError.text}</span> · {formatDateTime(new Date(r.lastError.at).toISOString())}
          </span>
        ) : (
          <span className="text-xs text-navy-600">—</span>
        ),
    },
  ]

  return (
    <PageShell title={t('status.title')} accent={t('status.accent')} subtitle={t('status.subtitle')}>
      <Panel
        title={t('status.summary', { up, total: rows.length })}
        actions={
          <>
            <Button size="sm" variant="secondary" icon={<Copy className="size-4" aria-hidden />} onClick={copy}>
              {t('status.copyEnv')}
            </Button>
            {mocksEnabled && (
              <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" aria-hidden />} onClick={reset}>
                {t('status.resetDemo')}
              </Button>
            )}
          </>
        }
      >
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
        <p className="mt-4 text-xs text-navy-600">{t('status.note')}</p>
      </Panel>
    </PageShell>
  )
}
