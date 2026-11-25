import { useRef, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import arrowLine from '@/assets/figma/arrow-line-white.svg'
import { cn } from '@/design/cn'
import { gsap, MOTION } from '@/lib/gsap'

const FINE_POINTER = '(hover: hover) and (pointer: fine)'
const MAX_TILT = 7 // degrees

type Movers = {
  rx: gsap.QuickToFunc
  ry: gsap.QuickToFunc
  lift: gsap.QuickToFunc
  gx: gsap.QuickToFunc
  gy: gsap.QuickToFunc
  ax: gsap.QuickToFunc
  ay: gsap.QuickToFunc
  rect: DOMRect
}

/**
 * Service card: 3D tilt toward the pointer, a soft light that follows it, the art drifting the other way (parallax),
 * and per-illustration motion in CSS (disc spins, gauge needle revs, pin lifts with ripples). Fine pointers only;
 * touch and reduced motion get the static card. The art is the Figma SVG inlined so its parts can move.
 */
export function ServiceCard({ to, title, body, cta, svg, art, bg }: { to: string; title: string; body: string; cta: string; svg: string; art: 'disc' | 'gauge' | 'pin'; bg: string }) {
  const card = useRef<HTMLAnchorElement>(null)
  const glare = useRef<HTMLDivElement>(null)
  const artEl = useRef<HTMLDivElement>(null)
  const movers = useRef<Movers | null>(null)

  const onEnter = () => {
    if (!card.current || !glare.current || !artEl.current) return
    if (!window.matchMedia(FINE_POINTER).matches || window.matchMedia(MOTION.reduce).matches) return
    if (!movers.current) {
      gsap.set(card.current, { transformPerspective: 1000 })
      const q = (el: Element, prop: string, duration = 0.6) => gsap.quickTo(el, prop, { duration, ease: 'power3' })
      movers.current = {
        rx: q(card.current, 'rotationX'),
        ry: q(card.current, 'rotationY'),
        lift: q(card.current, 'y', 0.5),
        gx: q(glare.current, 'x', 0.35),
        gy: q(glare.current, 'y', 0.35),
        ax: q(artEl.current, 'x', 0.8),
        ay: q(artEl.current, 'y', 0.8),
        rect: card.current.getBoundingClientRect(),
      }
    }
    movers.current.rect = card.current.getBoundingClientRect() // read once per hover, not per move
    movers.current.lift(-8)
  }

  const onMove = (e: PointerEvent) => {
    const m = movers.current
    if (!m || e.pointerType !== 'mouse') return
    const px = (e.clientX - m.rect.left) / m.rect.width // 0..1
    const py = (e.clientY - m.rect.top) / m.rect.height
    m.ry((px - 0.5) * 2 * MAX_TILT)
    m.rx((0.5 - py) * 2 * MAX_TILT)
    m.gx(e.clientX - m.rect.left)
    m.gy(e.clientY - m.rect.top)
    m.ax((0.5 - px) * 18)
    m.ay((0.5 - py) * 14)
  }

  const onLeave = () => {
    const m = movers.current
    if (!m) return
    m.rx(0)
    m.ry(0)
    m.lift(0)
    m.ax(0)
    m.ay(0)
  }

  return (
    <Link
      ref={card}
      to={to}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn(
        'svc-card group relative flex h-[420px] flex-col justify-between overflow-hidden rounded-panel p-7 text-white md:h-[480px]',
        'shadow-[0_18px_40px_-24px_rgb(7_26_58/0.55)] transition-shadow duration-500 ease-out hover:shadow-[0_40px_70px_-28px_rgb(7_26_58/0.7)]',
        'outline-none focus-visible:ring-4 focus-visible:ring-orange/50',
        bg,
      )}
    >
      {/* Light that follows the pointer (moved with transforms only; physical x/y, so physical left/top) */}
      <div
        ref={glare}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 -ml-[260px] -mt-[260px] size-[520px] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.20)_0%,rgb(255_255_255/0.06)_35%,transparent_65%)] opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
      />
      <div className="relative z-10 flex flex-col gap-3">
        <h3 className="text-[34px] font-light tracking-[-0.03em]">{title}</h3>
        <p className="text-[15px] text-white/85">{body}</p>
      </div>
      <div
        ref={artEl}
        aria-hidden
        data-svc-art
        className={cn('svc-art pointer-events-none absolute left-1/2 top-[130px] -ml-[100px] size-[200px] md:top-[140px] md:-ml-[130px] md:size-[260px]', `svc-art--${art}`)}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="relative z-10 pt-[18px] text-body font-medium">
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/40" />
        <span aria-hidden className="svc-line absolute inset-x-0 top-0 h-px origin-left bg-white rtl:origin-right" />
        <span className="flex items-center justify-between">
          {cta}
          <img src={arrowLine} alt="" aria-hidden width={18} height={14} className="flip-rtl transition-transform duration-200 ease-out group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
        </span>
      </div>
    </Link>
  )
}
