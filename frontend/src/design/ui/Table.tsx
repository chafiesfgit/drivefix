import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'
import { SkeletonRows } from './States'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
  /** Shown as the card title on small screens. */
  primary?: boolean
}

interface TableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  empty?: ReactNode
  caption?: string
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined
}

/**
 * Figma table (sand header, 48px rows). Turns into stacked cards under 768px so nothing
 * scrolls sideways on phones.
 */
export function DataTable<T>({ columns, rows, rowKey, loading, empty, caption, onRowClick, rowClassName }: TableProps<T>) {
  if (loading) return <SkeletonRows rows={4} className="py-2" />
  if (!rows || rows.length === 0) return <>{empty}</>
  const primary = columns.find((c) => c.primary) ?? columns[0]

  return (
    <>
      <table className="hidden w-full table-fixed border-collapse text-start md:table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-sand">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn('px-3 py-2 text-start text-xs font-medium text-navy-600 first:ps-3', c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-grey-200/60 last:border-0',
                onRowClick && 'cursor-pointer transition-colors duration-150 hover:bg-cream-50',
                rowClassName?.(row),
              )}
            >
              {columns.map((c, i) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-3 py-3 align-middle text-sm',
                    i === 0 ? 'font-medium text-navy-900' : 'text-navy-600',
                    'break-words',
                    c.className,
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col gap-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={cn('rounded-xl border border-grey-200 bg-white p-4', rowClassName?.(row))}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            <div className="mb-2 break-words text-sm font-semibold text-navy-900">{primary.cell(row)}</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              {columns
                .filter((c) => c !== primary)
                .map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-xs text-navy-600">{c.header}</dt>
                    <dd className="min-w-0 break-words text-end text-sm text-navy-900">{c.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
}) {
  const { t } = useTranslation()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label={t('common.pagination')}>
      <p className="tabular text-xs text-navy-600">{t('common.rangeOf', { from, to, total })}</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="pressable inline-flex size-9 items-center justify-center rounded-full border border-grey-200 bg-white text-navy-900 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={t('common.previous')}
        >
          <ChevronLeft className="flip-rtl size-4" aria-hidden />
        </button>
        <span className="tabular min-w-16 text-center text-xs text-navy-600">
          <bdi dir="ltr">{page} / {pages}</bdi>
        </span>
        <button
          type="button"
          className="pressable inline-flex size-9 items-center justify-center rounded-full border border-grey-200 bg-white text-navy-900 disabled:opacity-40"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label={t('common.next')}
        >
          <ChevronRight className="flip-rtl size-4" aria-hidden />
        </button>
      </div>
    </nav>
  )
}
