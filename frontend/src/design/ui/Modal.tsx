import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Prevent closing with Esc / backdrop while a request runs. */
  busy?: boolean
}

const EXIT_MS = 150

/**
 * Native <dialog> (focus trap, Esc, top layer for free).
 * Scales in from the element that opened it, exits faster than it enters.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', busy }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'closed' | 'open' | 'closing'>('closed')
  const titleId = useId()
  const descId = useId()
  const { t } = useTranslation()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      const trigger = document.activeElement as HTMLElement | null
      const panel = panelRef.current
      if (trigger && panel && trigger !== document.body) {
        const r = trigger.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight
        const x = ((r.left + r.width / 2) / vw) * 100
        const y = ((r.top + r.height / 2) / vh) * 100
        panel.style.transformOrigin = `${Math.min(Math.max(x, 0), 100)}% ${Math.min(Math.max(y, 0), 100)}%`
      }
      dialog.showModal()
      setState('open')
    } else if (!open && dialog.open) {
      setState('closing')
      const timer = window.setTimeout(() => {
        dialog.close()
        setState('closed')
      }, EXIT_MS)
      return () => window.clearTimeout(timer)
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onClose()
      }}
      className={cn(
        'fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-4 backdrop:bg-transparent',
        'flex items-end justify-center sm:items-center',
        state === 'closed' && 'hidden',
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none fixed inset-0 bg-night/50 backdrop-blur-[2px] transition-opacity',
          state === 'open' ? 'opacity-100 duration-200' : 'opacity-0 duration-150',
        )}
      />
      <div
        ref={panelRef}
        className={cn(
          'relative w-full rounded-panel bg-white p-6 shadow-float',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-lg',
          size === 'lg' && 'max-w-2xl',
          state === 'open' ? 'animate-pop-in' : 'scale-[0.97] opacity-0 transition-[opacity,transform] duration-150 ease-out',
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-h2 font-semibold text-navy-900">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-navy-600">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t('common.close')}
            className="pressable -me-2 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-navy-600 hover:bg-sand hover:text-navy-900 disabled:opacity-40"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
      </div>
    </dialog>
  )
}
