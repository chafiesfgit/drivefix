import { AlertTriangle, Inbox, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'
import { Button } from './Button'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('relative overflow-hidden rounded-md bg-sand', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent motion-reduce:hidden" />
    </div>
  )
}

/** Generic skeleton for list pages. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex flex-col gap-3', className)} role="status" aria-label={t('common.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
        </div>
      ))}
    </div>
  )
}

interface StateProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, icon, className }: StateProps) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-sand text-navy-600">
        {icon ?? <Inbox className="size-5" aria-hidden />}
      </div>
      <p className="text-h3 font-semibold text-navy-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-navy-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title,
  description,
  onRetry,
  offline,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  onRetry?: () => void
  offline?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div role="alert" className={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-danger-subtle text-danger">
        {offline ? <WifiOff className="size-5" aria-hidden /> : <AlertTriangle className="size-5" aria-hidden />}
      </div>
      <p className="text-h3 font-semibold text-navy-900">
        {title ?? (offline ? t('states.offlineTitle') : t('states.errorTitle'))}
      </p>
      <p className="mt-1 max-w-sm text-sm text-navy-600">
        {description ?? (offline ? t('states.offlineBody') : t('states.errorBody'))}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}
