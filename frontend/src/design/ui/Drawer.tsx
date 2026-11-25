import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

/** Side sheet from the inline-end edge (mobile navigation). Native <dialog> for focus + Esc. */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [visible, setVisible] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      requestAnimationFrame(() => setVisible(true))
    } else if (!open && d.open) {
      setVisible(false)
      const timer = window.setTimeout(() => d.close(), 220)
      return () => window.clearTimeout(timer)
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-transparent [&:not([open])]:hidden"
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none fixed inset-0 bg-night/60 transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        className={cn(
          'fixed inset-y-0 end-0 flex w-[min(320px,86vw)] flex-col bg-night text-white shadow-float',
          'transition-transform duration-300 ease-drawer',
          visible ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-sm font-semibold">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="pressable inline-flex size-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">{children}</div>
      </div>
    </dialog>
  )
}
