import { useRef, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Footer } from '@/app/layouts/Footer'
import { SkipLink } from '@/app/layouts/PublicLayout'
import { SiteNav } from '@/app/layouts/SiteNav'
import { cn } from '@/design/cn'
import { gsap, MOTION, ScrollTrigger, SplitText, useGSAP } from '@/lib/gsap'
import { useSmoothScroll } from '@/lib/smoothScroll'
import { Bento, Faq, FinalCta, FourSteps, Hero, MadeForAlgeria, PlatformStats, Services, ThreeWays, Ticker } from './sections'

const SECTIONS = ['services', 'how-it-works', 'built-for-algeria', 'faq'] as const
type SectionId = (typeof SECTIONS)[number]

export function LandingPage() {
  const { t, i18n } = useTranslation()
  const root = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const [condensed, setCondensed] = useState(false)
  const [active, setActive] = useState<SectionId | null>(null)
  const lenis = useSmoothScroll()

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      // Always on (also with reduced motion): nav state, scroll spy, progress bar. These are feedback, not decoration.
      ScrollTrigger.create({ start: 80, end: 'max', onToggle: (self) => setCondensed(self.isActive) })
      SECTIONS.forEach((id) => {
        ScrollTrigger.create({
          trigger: `#${id}`,
          start: 'top 45%',
          end: 'bottom 45%',
          onToggle: (self) => {
            if (self.isActive) setActive(id)
            else setActive((cur) => (cur === id ? null : cur))
          },
        })
      })
      gsap.fromTo(progress.current, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } })

      mm.add(MOTION.ok, () => {
        // Hero: headline split into lines, masked rise, staggered
        const split = SplitText.create('[data-hero-title]', { type: 'lines', mask: 'lines', autoSplit: true, linesClass: 'pb-[0.14em] -mb-[0.14em]', onSplit: (self) =>
          gsap.from(self.lines, { yPercent: 110, duration: 1, ease: 'power3.out', stagger: 0.09, delay: 0.1 }),
        })
        gsap.from('[data-hero-in]', { y: 18, autoAlpha: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08, delay: 0.35 })
        gsap.from('[data-hero-glow]', { autoAlpha: 0, yPercent: 8, duration: 1.6, ease: 'power2.out' })

        // Floating cards: three nested layers so no two motions ever write the same transform
        //   [data-float]      -> scroll parallax (smoothed scrub)
        //   [data-float-in]   -> entrance
        //   [data-float-card] -> idle drift
        // (Entrance + parallax on one element made the cards jump 40px on the first scroll.)
        const cards = gsap.utils.toArray<HTMLElement>('[data-float]')
        gsap.from('[data-float-in]', { y: 40, scale: 0.97, autoAlpha: 0, duration: 1.2, ease: 'power3.out', stagger: 0.14, delay: 0.5, force3D: true })
        // Idle drift: y and x on different periods trace a slow, soft loop; each card has its own rhythm and phase,
        // so the three never move in lockstep. sine.inOut has no hard turnarounds.
        const DRIFT = [
          { y: 9, x: 3, dy: 3.4, dx: 5.1 },
          { y: -10, x: -4, dy: 4.1, dx: 6.3 },
          { y: 8, x: 3, dy: 3.8, dx: 5.7 },
        ]
        const floats = cards.flatMap((el, i) => {
          const card = el.querySelector('[data-float-card]')
          const d = DRIFT[i % DRIFT.length]
          return [
            gsap.to(card, { y: d.y, duration: d.dy, ease: 'sine.inOut', yoyo: true, repeat: -1, force3D: true }).progress(i * 0.31),
            gsap.to(card, { x: d.x, duration: d.dx, ease: 'sine.inOut', yoyo: true, repeat: -1, force3D: true }).progress(i * 0.47 + 0.2),
          ]
        })
        cards.forEach((el) => {
          gsap.to(el, {
            y: () => -90 * Number(el.dataset.depth ?? 1),
            ease: 'none',
            force3D: true,
            scrollTrigger: { trigger: '[data-hero-cards]', start: 'top top', end: '+=700', scrub: 0.8 },
          })
        })
        ScrollTrigger.create({
          trigger: '[data-hero-cards]',
          start: 'top bottom',
          end: 'bottom top',
          onToggle: (self) => floats.forEach((f) => (self.isActive ? f.play() : f.pause())),
        })

        // Ticker pauses when off-screen
        const track = document.querySelector<HTMLElement>('[data-ticker-track]')
        ScrollTrigger.create({
          trigger: '[data-ticker]',
          start: 'top bottom',
          end: 'bottom top',
          onToggle: (self) => track && (track.style.animationPlayState = self.isActive ? 'running' : 'paused'),
        })

        // Section reveals: 24px rise + fade, once
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
          gsap.from(el, { y: 24, autoAlpha: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } })
        })
        gsap.utils.toArray<HTMLElement>('[data-stagger]').forEach((group) => {
          gsap.from(group.querySelectorAll('[data-stagger-item]'), {
            y: 24,
            autoAlpha: 0,
            duration: 0.7,
            ease: 'power3.out',
            stagger: 0.08,
            scrollTrigger: { trigger: group, start: 'top 85%', once: true },
          })
        })

        // Four steps: line draws with scroll, dots light up as it passes them
        const dots = gsap.utils.toArray<HTMLElement>('[data-step-dot]')
        gsap.fromTo(
          '[data-steps-line]',
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: '[data-steps]',
              start: 'top 70%',
              end: 'center 45%',
              scrub: 0.5,
              onUpdate: (self) => dots.forEach((d, i) => d.classList.toggle('!border-orange', self.progress >= i / (dots.length - 1) - 0.02)),
            },
          },
        )

        // Services: cards rise in with a slight forward tilt, art settles in after its card
        gsap.from('[data-svc-item]', {
          y: 70,
          autoAlpha: 0,
          rotationX: -10,
          transformPerspective: 1000,
          transformOrigin: '50% 0%',
          duration: 1.1,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: { trigger: '[data-svc]', start: 'top 82%', once: true },
        })
        gsap.from('[data-svc-art]', {
          scale: 0.86,
          rotation: -24,
          autoAlpha: 0,
          duration: 1.4,
          ease: 'power3.out',
          stagger: 0.12,
          delay: 0.2,
          scrollTrigger: { trigger: '[data-svc]', start: 'top 82%', once: true },
        })

        // Platform: each card "loads" in turn: sweep of light, count-up, and its visual fills in step with the number
        const rtl = document.documentElement.dir === 'rtl'
        const pcards = gsap.utils.toArray<HTMLElement>('[data-pcard]')
        const tl = gsap.timeline({ scrollTrigger: { trigger: '[data-platform]', start: 'top 70%', once: true } })
        tl.from(pcards, { y: 40, autoAlpha: 0, scale: 0.97, duration: 0.8, ease: 'power3.out', stagger: 0.14 })
        pcards.forEach((card, i) => {
          const at = 0.3 + i * 0.14
          const sheen = card.querySelector('[data-sheen]')
          if (sheen) tl.fromTo(sheen, { xPercent: rtl ? 400 : 0 }, { xPercent: rtl ? 0 : 400, duration: 1.3, ease: 'power2.inOut' }, at)
          const num = card.querySelector<HTMLElement>('[data-pcount]')
          if (num) {
            const target = Number(num.dataset.pcount)
            const obj = { v: 0 }
            num.textContent = '0'
            tl.to(obj, { v: target, duration: 1.4, ease: 'power2.out', onUpdate: () => (num.textContent = String(Math.round(obj.v))) }, at)
          }
          const dots = card.querySelectorAll('[data-dot]')
          if (dots.length) tl.from(dots, { backgroundColor: 'rgba(255,255,255,0.14)', scale: 0.55, duration: 0.35, ease: 'power2.out', stagger: { amount: 1.2, grid: [2, 29], from: rtl ? 'end' : 'start', axis: 'x' } }, at + 0.05)
          const segs = card.querySelectorAll('[data-seg]')
          if (segs.length) {
            tl.from(segs, { scaleX: 0, duration: 0.45, ease: 'power3.out', stagger: 0.2 }, at + 0.05)
            tl.from(card.querySelectorAll('[data-seg-icon]'), { y: 6, autoAlpha: 0, duration: 0.45, ease: 'power3.out', stagger: 0.2 }, at + 0.15)
          }
          const chips = card.querySelectorAll('[data-chip]')
          if (chips.length) tl.from(chips, { y: 10, autoAlpha: 0, scale: 0.95, duration: 0.5, ease: 'power3.out', stagger: 0.35 }, at + 0.1)
        })

        gsap.from('[data-cta-glow]', { yPercent: 20, autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: '[data-cta-glow]', start: 'top bottom', end: 'top 60%', scrub: true } })

        return () => split.revert()
      })
    },
    { scope: root, dependencies: [i18n.language], revertOnUpdate: true },
  )

  const goTo = (id: SectionId) => (e: MouseEvent) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    if (lenis.current) lenis.current.scrollTo(el, { offset: -88, duration: 1.4 })
    else el.scrollIntoView({ behavior: window.matchMedia(MOTION.reduce).matches ? 'auto' : 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
  }

  const links = [
    { label: t('nav.services'), to: '#services', active: active === 'services', onClick: goTo('services') },
    { label: t('nav.howItWorks'), to: '#how-it-works', active: active === 'how-it-works', onClick: goTo('how-it-works') },
    { label: t('nav.builtForAlgeria'), to: '#built-for-algeria', active: active === 'built-for-algeria', onClick: goTo('built-for-algeria') },
    { label: t('nav.faq'), to: '#faq', active: active === 'faq', onClick: goTo('faq') },
  ]

  return (
    <div ref={root} className="min-h-dvh bg-cream-50">
      <SkipLink />
      <div
        ref={progress}
        role="presentation"
        className="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-orange shadow-[0_0_12px_rgb(242_106_27/0.8)] rtl:origin-right"
        style={{ transform: 'scaleX(0)' }}
      />
      <header className="fixed inset-x-0 top-1 z-40">
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 -top-1 border-b border-white/10 bg-night/75 backdrop-blur-xl transition-opacity duration-300 ease-out',
            condensed ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div className="relative">
          <SiteNav links={links} anchors condensed={condensed} />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Ticker />
        <Services />
        <FourSteps />
        <PlatformStats />
        <MadeForAlgeria />
        <ThreeWays />
        <Bento />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
