import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../cn'

/**
 * Small dropdown that scales from its trigger (origin top-end), closes on outside click / Esc
 * and returns focus to the trigger.
 */
export function Popover({
  trigger,
  children,
  align = 'end',
  className,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  className?: string
  label: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        ;(ref.current?.querySelector('[aria-haspopup]') as HTMLElement | null)?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={cn(
            'absolute top-[calc(100%+8px)] z-50 animate-pop-in rounded-card border border-grey-200 bg-white shadow-float',
            align === 'end' ? 'end-0 origin-top-right rtl:origin-top-left' : 'start-0 origin-top-left rtl:origin-top-right',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
