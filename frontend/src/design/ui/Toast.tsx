import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

export type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  description?: string
  leaving?: boolean
}

interface ToastApi {
  show: (t: Omit<ToastItem, 'id' | 'leaving'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const DURATION = 4500
const EXIT_MS = 180

const TONE = {
  success: { Icon: CheckCircle2, cls: 'border-success/25', icon: 'text-success' },
  error: { Icon: XCircle, cls: 'border-danger/25', icon: 'text-danger' },
  info: { Icon: Info, cls: 'border-info/25', icon: 'text-info' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const { t } = useTranslation()

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, leaving: true } : i)))
    window.setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), EXIT_MS)
  }, [])

  const show = useCallback(
    (toast: Omit<ToastItem, 'id' | 'leaving'>) => {
      const id = nextId.current++
      setItems((list) => {
        // Same message twice in a row: do not stack duplicates
        const filtered = list.filter((i) => !(i.title === toast.title && i.tone === toast.tone))
        return [...filtered.slice(-3), { ...toast, id }]
      })
      window.setTimeout(() => dismiss(id), DURATION)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ tone: 'success', title, description }),
      error: (title, description) => show({ tone: 'error', title, description }),
      info: (title, description) => show({ tone: 'info', title, description }),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:end-6 sm:bottom-6 sm:items-end"
      >
        {items.map((item) => {
          const { Icon, cls, icon } = TONE[item.tone]
          return (
            <div
              key={item.id}
              role={item.tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex w-full max-w-[360px] items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-panel',
                cls,
                item.leaving
                  ? 'translate-y-2 opacity-0 transition-[opacity,transform] duration-150 ease-out'
                  : 'animate-toast-in',
              )}
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', icon)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-navy-900">{item.title}</p>
                {item.description && <p className="mt-0.5 break-words text-xs text-navy-600">{item.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label={t('common.dismiss')}
                className="-me-1 -mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-navy-600 hover:bg-sand"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
