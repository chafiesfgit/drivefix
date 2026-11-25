import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { PageShell } from '@/app/layouts/PageShell'
import { checkHealth } from '@/api'
import {
  Button,
  Checkbox,
  DataTable,
  EmptyState,
  ErrorState,
  Eyebrow,
  Input,
  LangToggle,
  ListRow,
  Logo,
  Modal,
  Pagination,
  Panel,
  PasswordInput,
  Segmented,
  Select,
  SkeletonRows,
  StatTile,
  StatusChip,
  Tag,
  Textarea,
  TrustBadge,
  useToast,
  type ButtonVariant,
  type Column,
} from '@/design/ui'
import { isMocked, SERVICE_IDS, SERVICE_NAMES, serviceUrl } from '@/lib/env'
import { formatDZD } from '@/lib/format'

const COLORS: [string, string][] = [
  ['ink', '#0F1B2D'],
  ['navy-900', '#0E1B33'],
  ['night', '#071A3A'],
  ['night-800', '#0B2A5B'],
  ['brand', '#1F4E9E'],
  ['orange', '#F26A1B'],
  ['orange-hover', '#C94F0A'],
  ['cream-50', '#FBF8F1'],
  ['cream-100', '#F4EFE3'],
  ['sand', '#EFE9DB'],
  ['grey-200', '#DCD5C4'],
  ['grey-400', '#9A9484'],
  ['navy-600', '#55627A'],
  ['mist', '#F7F9FC'],
  ['success', '#177A47'],
  ['danger', '#C0392B'],
  ['warning', '#A8620A'],
  ['info', '#1F4E9E'],
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel title={title} className="mb-6">
      {children}
    </Panel>
  )
}

interface Row {
  id: string
  name: string
  role: string
  wilaya: string
  status: 'Pending' | 'Approved' | 'Rejected'
}

const ROWS: Row[] = [
  { id: '1', name: 'Garage El Baraka', role: 'Mechanic', wilaya: '35 — Boumerdès', status: 'Pending' },
  { id: '2', name: 'AutoPièces Réghaïa Bab Ezzouar Centre Commercial (very long name)', role: 'Supplier', wilaya: '16 — Alger', status: 'Pending' },
  { id: '3', name: 'Dépannage Rouiba', role: 'Tow driver', wilaya: '16 — Alger', status: 'Approved' },
]

/** Storybook-like page: every primitive in every state. */
export function DesignPage() {
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [seg, setSeg] = useState<'all' | 'pending' | 'done'>('all')
  const [page, setPage] = useState(1)
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => Object.fromEntries(await Promise.all(SERVICE_IDS.map(async (s) => [s, await checkHealth(s)] as const))),
    refetchInterval: 15000,
    meta: { silent: true },
  })
  const variants: ButtonVariant[] = ['primary', 'accent', 'secondary', 'ghost', 'danger', 'white']
  const columns: Column<Row>[] = [
    { key: 'name', header: 'Applicant', cell: (r) => r.name, primary: true },
    { key: 'role', header: 'Role', cell: (r) => r.role },
    { key: 'wilaya', header: 'Wilaya', cell: (r) => r.wilaya },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StatusChip tone={r.status === 'Approved' ? 'success' : r.status === 'Rejected' ? 'danger' : 'warning'}>{r.status}</StatusChip>,
    },
  ]

  return (
    <PageShell title="Design" accent="system" subtitle="Tokens and primitives from the Figma Design System page, in every state">
      <Section title="Services (real or mocked)">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_IDS.map((s) => (
            <li key={s} className="flex items-center justify-between gap-3 rounded-xl border border-grey-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-900">
                  {s.toUpperCase()} {SERVICE_NAMES[s]}
                </p>
                <p className="truncate text-xs text-navy-600">{serviceUrl(s)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusChip tone={isMocked(s) ? 'info' : 'neutral'}>{isMocked(s) ? 'Mocked' : 'Real'}</StatusChip>
                {health.data && (
                  <StatusChip tone={health.data[s] ? 'success' : 'danger'}>{health.data[s] ? 'Up' : 'Down'}</StatusChip>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Colours">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {COLORS.map(([name, hex]) => (
            <div key={name}>
              <div className="h-12 rounded-lg border border-black/5" style={{ background: hex }} />
              <p className="mt-1 text-xs font-medium text-navy-900">{name}</p>
              <p dir="ltr" className="text-start text-[11px] text-navy-600">
                {hex}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-3">
          <p className="text-display font-light text-navy-900">
            Display 56 <span className="font-serif italic text-orange">accent</span>
          </p>
          <p className="text-display-sm text-navy-900">Display 32/40</p>
          <p className="text-h1 text-navy-900">Heading H1 28/36</p>
          <p className="text-h2 font-medium text-navy-900">Heading H2 20/28</p>
          <p className="text-h3 font-semibold text-navy-900">Heading H3 16/24</p>
          <p className="text-body text-navy-900">Body 16/24 — Compare prices from verified suppliers.</p>
          <p className="text-sm text-navy-600">Body M 14/20 secondary text</p>
          <p className="text-xs text-navy-600">Body S 12/16</p>
          <p className="eyebrow text-orange-hover">Eyebrow 11/15 caps</p>
          <p className="text-price font-bold text-navy-900">{formatDZD(4500)}</p>
          <p className="font-stat text-[56px] font-light leading-none text-navy-900">58</p>
          <p lang="ar" dir="rtl" className="font-arabic text-h2 font-semibold text-navy-900">
            قطع الغيار والميكانيكيون وسحب الطوارئ
          </p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-col gap-4">
          {variants.map((v) => (
            <div key={v} className="flex flex-wrap items-center gap-3">
              <span className="w-20 text-xs text-navy-600">{v}</span>
              <Button variant={v} arrow>
                Button
              </Button>
              <Button variant={v}>Button</Button>
              <Button variant={v} size="sm">
                Small
              </Button>
              <Button variant={v} arrow disabled>
                Disabled
              </Button>
              <Button variant={v} loading>
                Loading
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-night p-4">
            <Button variant="white" arrow>
              Search parts
            </Button>
            <Button variant="accent" arrow>
              Call a tow
            </Button>
            <Button variant="glass" icon={<Search className="size-4" aria-hidden />}>
              Glass
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Fields">
        <div className="grid gap-5 md:grid-cols-3">
          <Input label="Label" placeholder="Value" helper="Helper text" />
          <Input label="Label" defaultValue="Value" error="Error message" />
          <Input label="Label" defaultValue="Value" helper="Helper text" disabled />
          <PasswordInput label="Password" defaultValue="Password123" helper="At least 8 characters" />
          <Select label="Wilaya" placeholder="Choose…" options={[{ value: '16', label: '16 — Alger' }, { value: '31', label: '31 — Oran' }]} />
          <Textarea label="Note" placeholder="Anything the mechanic should know" />
          <Checkbox label="I accept the terms" />
          <Checkbox label="With an error" error="Please accept the terms to continue" />
        </div>
        <div className="mt-5 rounded-xl bg-night p-5">
          <Input tone="dark" label="Vehicle (dark tone)" placeholder="Renault Symbol 2016" helper="Choose manually — VIN is optional" />
        </div>
      </Section>

      <Section title="Chips, badges, tags">
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip tone="success">Approved</StatusChip>
          <StatusChip tone="danger">Rejected</StatusChip>
          <StatusChip tone="warning">Pending</StatusChip>
          <StatusChip tone="info">Shipped</StatusChip>
          <StatusChip tone="neutral">Draft</StatusChip>
          <StatusChip tone="orange">Urgent</StatusChip>
          <TrustBadge state="verified" />
          <TrustBadge state="pending" />
          <TrustBadge state="unverified" />
          <Tag>Parts</Tag>
          <Eyebrow>How it works</Eyebrow>
        </div>
      </Section>

      <Section title="Cards and rows">
        <div className="grid gap-4 md:grid-cols-3">
          <StatTile value="12" label="Pending applications" />
          <StatTile value={formatDZD(184500)} label="Orders this week" />
          <div className="panel p-5">
            <ListRow label="Order" value="#A1B2C3" />
            <ListRow label="Total" value={formatDZD(5000)} />
            <ListRow label="Payment" value="Cash on delivery" />
          </div>
        </div>
      </Section>

      <Section title="Table (cards under 768px), filters, pagination">
        <Segmented
          label="Filter"
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'all', label: 'All', count: 3 },
            { value: 'pending', label: 'Pending', count: 2 },
            { value: 'done', label: 'Done' },
          ]}
          className="mb-4"
        />
        <DataTable columns={columns} rows={ROWS} rowKey={(r) => r.id} caption="Applications" />
        <Pagination page={page} pageSize={3} total={11} onPage={setPage} />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-grey-200 bg-white p-4">
            <p className="mb-2 text-xs text-navy-600">Loading</p>
            <DataTable columns={columns} rows={undefined} rowKey={(r) => r.id} loading />
          </div>
          <div className="rounded-xl border border-grey-200 bg-white p-4">
            <p className="mb-2 text-xs text-navy-600">Empty</p>
            <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} empty={<EmptyState title="No applications" description="New requests will show up here." />} />
          </div>
        </div>
      </Section>

      <Section title="States">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-grey-200 bg-white p-4">
            <SkeletonRows rows={3} />
          </div>
          <div className="rounded-xl border border-grey-200 bg-white">
            <ErrorState onRetry={() => toast.info('Retrying…')} />
          </div>
          <div className="rounded-xl border border-grey-200 bg-white">
            <ErrorState offline onRetry={() => toast.info('Retrying…')} />
          </div>
        </div>
      </Section>

      <Section title="Overlays and feedback">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setModal(true)}>
            Open modal
          </Button>
          <Button variant="secondary" onClick={() => toast.success('Order confirmed', 'The supplier was notified.')}>
            Success toast
          </Button>
          <Button variant="secondary" onClick={() => toast.error('Wrong code. Check the SMS and try again.')}>
            Error toast
          </Button>
          <Button variant="secondary" onClick={() => toast.info('A new code was sent.')}>
            Info toast
          </Button>
        </div>
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="Reject application"
          description="The applicant receives this reason by SMS."
          footer={
            <>
              <Button variant="ghost" onClick={() => setModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" arrow onClick={() => setModal(false)}>
                Reject
              </Button>
            </>
          }
        >
          <Textarea label="Reason" placeholder="Document number does not match the business name" />
        </Modal>
      </Section>

      <Section title="Brand and language">
        <div className="flex flex-wrap items-center gap-6">
          <div className="rounded-xl bg-night p-4">
            <Logo mode="dark" to={null} size="lg" />
          </div>
          <Logo mode="light" to={null} size="lg" />
          <div className="rounded-xl bg-night p-3">
            <LangToggle />
          </div>
          <LangToggle tone="light" />
        </div>
      </Section>
    </PageShell>
  )
}
