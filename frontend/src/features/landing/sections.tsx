import { Car, Headset, Package, Plus, ShieldCheck, Truck, Wrench } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import arrowLine from '@/assets/figma/arrow-line-white.svg'
import artBrake from '@/assets/figma/art-brake-disc.svg?raw'
import artGauge from '@/assets/figma/art-gauge.svg?raw'
import artPin from '@/assets/figma/art-location-pin.svg?raw'
import heroArc from '@/assets/figma/hero-arc.svg'
import heroGlow from '@/assets/figma/hero-glow.svg'
import oilFilter from '@/assets/figma/icon-oil-filter.svg'
import mechanicPhoto from '@/assets/figma/mechanic.webp'
import pin from '@/assets/figma/pin.svg'
import { cn } from '@/design/cn'
import { Button, ButtonLink, Eyebrow, Input, Tag } from '@/design/ui'
import { formatDZD } from '@/lib/format'
import { ServiceCard } from './ServiceCard'

/* ------------------------------------------------------------------ Hero */

function FloatingCards() {
  const { t } = useTranslation()
  return (
    <div aria-hidden className="pointer-events-none absolute end-[44px] top-[clamp(96px,calc(100%_-_603px),117px)] hidden h-[482px] w-[370px] xl:block" data-hero-cards>
      {/* Mechanic booking (glass) */}
      <div data-float="2" data-depth="0.6" className="absolute will-change-transform start-0 top-[160px] w-[280px]">
        <div data-float-in className="will-change-transform">
          <div data-float-card className="relative overflow-hidden will-change-transform rounded-panel border-[1.5px] border-white/85 p-5 shadow-float">
            <div className="absolute inset-0 bg-[linear-gradient(147deg,rgb(255_255_255/0.26)_0%,rgb(255_255_255/0.07)_71%)] backdrop-blur-[20px]" />
            <div className="relative flex flex-col gap-3">
              <p className="text-[11.25px] font-semibold uppercase tracking-[0.08em] text-white/70">{t('landing.cardMechEyebrow')}</p>
              <p className="text-[20px] font-bold leading-[25px] text-white">{t('landing.cardMechTitle')}</p>
              <div dir="ltr" className="flex flex-wrap gap-2.5">
                {['08:00', '09:30', '11:00', '14:00'].map((s) => (
                  <span
                    key={s}
                    className={cn(
                      'rounded-full px-4 py-[7px] text-[12.5px]',
                      s === '09:30' ? 'bg-white/95 font-semibold text-night shadow-[0_5px_12px_rgb(0_0_26/0.25)]' : 'border-[1.25px] border-white/40 bg-white/10 font-medium text-white',
                    )}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_-12px_25px_rgb(255_255_255/0.2),inset_0_2px_2px_rgb(255_255_255/0.6)]" />
          </div>
        </div>
      </div>
      {/* SOS towing (orange) */}
      <div data-float="1" data-depth="1" className="absolute will-change-transform start-[116px] top-0 w-[254px]">
        <div data-float-in className="will-change-transform">
          <div data-float-card className="relative overflow-hidden will-change-transform rounded-panel border-[1.5px] border-white/85 bg-orange p-5 shadow-[0_20px_45px_-5px_rgb(106_35_0/0.4)]">
            <div className="relative flex flex-col gap-3">
              <p className="text-[11.25px] font-semibold uppercase tracking-[0.08em] text-white/85">{t('landing.cardSosEyebrow')}</p>
              <p className="text-[20px] font-bold leading-[25px] text-white">{t('landing.cardSosTitle')}</p>
              <div className="flex items-end justify-between gap-2">
                <div className="flex flex-col gap-0.5 text-[11.25px] font-semibold text-white/90">
                  <span>{t('landing.cardSosEta')}</span>
                  <span>{t('landing.cardSosPlace')}</span>
                </div>
                <span className="flex size-[35px] shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-orange">SOS</span>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_-12px_25px_rgb(255_255_255/0.2),inset_0_2px_2px_rgb(255_255_255/0.7)]" />
          </div>
        </div>
      </div>
      {/* Parts (glass) */}
      <div data-float="3" data-depth="0.8" className="absolute will-change-transform start-[82px] top-[326px] w-[288px]">
        <div data-float-in className="will-change-transform">
          <div data-float-card className="relative overflow-hidden will-change-transform rounded-panel border-[1.5px] border-white/85 px-5 py-[17px] shadow-float">
            <div className="absolute inset-0 bg-[linear-gradient(157deg,rgb(255_255_255/0.26)_0%,rgb(255_255_255/0.07)_71%)] backdrop-blur-[20px]" />
            <div className="relative flex flex-col gap-3">
              <p className="text-[11.25px] font-semibold uppercase tracking-[0.08em] text-white/70">{t('landing.cardPartsEyebrow')}</p>
              <div className="flex items-center gap-[15px]">
                <div className="relative flex size-[55px] shrink-0 items-center justify-center rounded-[12.5px] bg-[linear-gradient(135deg,#2f6fd6_0%,#0f2a5e_71%)] shadow-[inset_0_1px_1px_rgb(255_255_255/0.45)]">
                  <img src={oilFilter} alt="" width={32.5} height={32.5} className="size-[32.5px]" />
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="whitespace-nowrap text-[17.5px] font-bold text-white">{t('landing.cardPartsTitle')}</p>
                  <span className="self-start rounded-full border-[1.25px] border-[#7ee2b0]/50 bg-[#34d399]/20 px-2.5 py-1 text-[11.25px] font-semibold text-[#9bf2c8]">
                    {t('landing.cardPartsBadge')}
                  </span>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_-12px_25px_rgb(255_255_255/0.2),inset_0_2px_2px_rgb(255_255_255/0.6)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [vehicle, setVehicle] = useState('')
  const [part, setPart] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const p = new URLSearchParams()
    if (vehicle.trim()) p.set('vehicle', vehicle.trim())
    if (part.trim()) p.set('q', part.trim())
    navigate(`/parts${p.toString() ? `?${p}` : ''}`)
  }

  return (
    <section className="relative isolate overflow-hidden bg-night" aria-labelledby="hero-title">
      <img aria-hidden src={heroGlow} alt="" className="pointer-events-none absolute left-1/2 top-[470px] -z-10 h-[900px] w-[1500px] max-w-none -translate-x-1/2" data-hero-glow />
      <img aria-hidden src={heroArc} alt="" className="pointer-events-none absolute left-1/2 top-[330px] -z-10 size-[1400px] max-w-none -translate-x-1/2" data-hero-arc />
      <div className="mx-auto flex min-h-[min(720px,100svh)] max-w-page flex-col justify-end gap-7 px-[var(--page-gutter)] pb-16 pt-28">
        <span data-hero-in className="self-start rounded-full border border-orange/60 bg-orange/[0.22] px-3 py-1 text-xs font-medium text-orange-soft">
          {t('landing.eyebrow')}
        </span>
        <h1 id="hero-title" data-hero-title className="max-w-[940px] text-hero font-light text-white">
          {t('landing.heroA')} <span className="font-serif text-[1.14em] italic tracking-[-0.03em] text-orange">{t('landing.heroAccent')}</span> {t('landing.heroB')}
        </h1>
        <p data-hero-in className="max-w-[640px] text-[18px] leading-6 text-haze">
          {t('landing.heroSub')}
        </p>
        <form
          data-hero-in
          role="search"
          aria-label={t('landing.searchLabel')}
          onSubmit={onSubmit}
          className="glass-dark flex w-full max-w-[940px] flex-col gap-4 rounded-panel p-5 shadow-glass md:flex-row md:items-start"
        >
          <Input tone="dark" label={t('landing.vehicle')} placeholder={t('landing.vehiclePh')} helper={t('landing.vehicleHelp')} value={vehicle} onChange={(e) => setVehicle(e.target.value)} containerClassName="md:w-[280px]" className="rounded-[10px]" autoComplete="off" />
          <Input tone="dark" label={t('landing.part')} placeholder={t('landing.partPh')} helper={t('landing.partHelp')} value={part} onChange={(e) => setPart(e.target.value)} containerClassName="md:w-[280px]" className="rounded-[10px]" autoComplete="off" />
          <div className="flex flex-wrap gap-3 md:pt-[21px]">
            <Button type="submit" variant="white" arrow>
              {t('landing.searchParts')}
            </Button>
            <ButtonLink to="/sos" variant="accent" arrow>
              {t('landing.callTow')}
            </ButtonLink>
          </div>
        </form>
      </div>
      <FloatingCards />
    </section>
  )
}

/* ---------------------------------------------------------------- Ticker */

export function Ticker() {
  const { t } = useTranslation()
  const items = ['ticker1', 'ticker2', 'ticker3', 'ticker4', 'ticker5', 'ticker6'].map((k) => t(`landing.${k}`))
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-12 pe-12">
      {items.map((x) => (
        <li key={x} className="flex items-center gap-12 whitespace-nowrap text-[18px] font-light text-white">
          {x}
          <span aria-hidden className="size-1.5 rounded-full bg-white/60" />
        </li>
      ))}
    </ul>
  )
  return (
    <div className="relative flex h-14 items-center overflow-hidden bg-orange" data-ticker>
      <div className="flex w-max animate-marquee motion-reduce:animate-none rtl:animate-marquee-rtl" data-ticker-track>
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- Services */

export function Services() {
  const { t } = useTranslation()
  const cards = [
    { title: t('landing.svcPartsTitle'), body: t('landing.svcPartsBody'), svg: artBrake, art: 'disc' as const, to: '/parts', bg: 'bg-[linear-gradient(156deg,#16468e_0%,#0b2a5b_47%,#071a3a_78%)]' },
    { title: t('landing.svcMechTitle'), body: t('landing.svcMechBody'), svg: artGauge, art: 'gauge' as const, to: '/mechanics', bg: 'bg-[linear-gradient(156deg,#1a2b4a_0%,#0e1b33_78%)]' },
    { title: t('landing.svcSosTitle'), body: t('landing.svcSosBody'), svg: artPin, art: 'pin' as const, to: '/sos', bg: 'bg-[linear-gradient(156deg,#f26a1b_0%,#c24a09_78%)]' },
  ]
  return (
    <section id="services" className="scroll-mt-24 bg-cream-50 py-20 md:py-24" aria-labelledby="services-title">
      <div className="container-page">
        <p data-reveal className="eyebrow text-xs tracking-[0.14em] text-orange-hover">{t('landing.servicesEyebrow')}</p>
        <h2 id="services-title" data-reveal className="mt-6 max-w-[1000px] text-[clamp(2.25rem,1.4rem+3vw,3.5rem)] font-light leading-[1.1] tracking-[-0.035em] text-navy-900">
          {t('landing.servicesTitle')}
        </h2>
        <ul className="mt-12 grid gap-[18px] md:grid-cols-3" data-svc>
          {cards.map((c) => (
            <li key={c.to} data-svc-item>
              <ServiceCard to={c.to} title={c.title} body={c.body} cta={t('landing.explore')} svg={c.svg} art={c.art} bg={c.bg} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ Four steps */

export function FourSteps() {
  const { t } = useTranslation()
  const steps = [1, 2, 3, 4].map((n) => ({
    title: t(`landing.step${n}Title`),
    body: t(`landing.step${n}Body`),
    tag: t(`landing.step${n}Tag`),
  }))
  return (
    <section id="how-it-works" className="relative scroll-mt-24 overflow-hidden bg-cream-100 py-20 md:py-24" aria-labelledby="steps-title" data-steps>
      <div aria-hidden className="pointer-events-none absolute -start-20 top-[280px] size-[420px] rounded-full bg-orange/40 blur-[90px]" />
      <div aria-hidden className="pointer-events-none absolute start-[38%] top-[60px] size-[360px] rounded-full bg-orange/20 blur-[90px]" />
      <div aria-hidden className="pointer-events-none absolute end-[20%] top-[300px] size-[420px] rounded-full bg-[#9fb7e6]/40 blur-[90px]" />
      <div className="container-page relative">
        <Eyebrow>{t('landing.stepsEyebrow')}</Eyebrow>
        <h2 id="steps-title" data-reveal className="mt-6 max-w-[820px] text-[clamp(2.25rem,1.4rem+3vw,3.5rem)] font-light leading-[1.1] tracking-[-0.035em] text-navy-900">
          {t('landing.stepsTitle')} <span className="font-serif italic text-orange-ink">{t('landing.stepsAccent')}</span>
        </h2>
        <ol className="relative mt-12 grid gap-4 md:grid-cols-4 md:gap-[18px]">
          {/* Timeline: grey track + orange line that draws on scroll */}
          <div aria-hidden className="absolute inset-x-[10px] top-[9px] hidden h-0.5 bg-grey-200 md:block" />
          <div aria-hidden data-steps-line className="absolute inset-x-[10px] top-[9px] hidden h-0.5 origin-left bg-orange md:block rtl:origin-right" />
          {steps.map((s, i) => (
            <li key={s.title} className="relative md:pt-10" data-step>
              <span aria-hidden data-step-dot className={cn('absolute start-[2px] top-[2px] hidden size-4 rounded-full border-2 bg-cream-50 transition-colors duration-300 md:block', i === 0 ? 'border-orange' : 'border-grey-400')} />
              <div className="h-full rounded-card border border-white/80 bg-white/55 p-4 shadow-[0_10px_30px_-12px_rgb(8_26_59/0.15)] backdrop-blur-md">
                <p className="mb-1 font-stat text-xs font-light text-orange-hover md:hidden">0{i + 1}</p>
                <h3 className="text-h3 font-semibold text-navy-900">{s.title}</h3>
                <p className="mt-3 text-[13px] leading-5 text-navy-600">{s.body}</p>
                <p className="eyebrow mt-4 text-[10px] text-orange-hover">{s.tag}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* -------------------------------------------------------- Platform stats */

const ROLE_ICONS = [Car, Package, Wrench, Truck, Headset, ShieldCheck]

export function PlatformStats() {
  const { t } = useTranslation()
  const stats = [
    { n: 58, unit: t('landing.statWilayas'), body: t('landing.statWilayasBody'), viz: 'dots' as const },
    { n: 6, unit: t('landing.statRoles'), body: t('landing.statRolesBody'), viz: 'roles' as const },
    { n: 3, unit: t('landing.statLanguages'), body: t('landing.statLanguagesBody'), viz: 'langs' as const },
  ]
  return (
    <section className="relative overflow-hidden bg-[#0a1a3a] py-20 md:py-24" aria-labelledby="platform-title" data-platform>
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -start-20 size-[520px] rounded-full bg-[#1f4e9e]/50 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -end-32 -top-20 size-[620px] rounded-full bg-[#7a3b1f]/45 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 start-[40%] size-[380px] rounded-full bg-orange/25 blur-[120px]" />
      <div className="container-page relative">
        <Eyebrow tone="dark">{t('landing.platformEyebrow')}</Eyebrow>
        <h2 id="platform-title" data-reveal className="mt-6 max-w-[820px] text-[clamp(2.25rem,1.4rem+3vw,3.5rem)] font-light leading-[1.1] tracking-[-0.035em] text-white">
          {t('landing.platformTitle')} <span className="font-serif italic text-orange">{t('landing.platformAccent')}</span>
        </h2>
        <ul className="mt-12 grid gap-[18px] md:grid-cols-3">
          {stats.map((s) => (
            <li key={s.unit} data-pcard className="glass-dark relative flex flex-col overflow-hidden rounded-panel p-6 md:p-8">
              {/* One-time light sweep while the card "loads" */}
              <span aria-hidden data-sheen className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.12),transparent)]" />
              <p className="flex items-baseline gap-3">
                <span data-pcount={s.n} className="tabular font-stat text-[72px] font-light leading-none text-white">
                  {s.n}
                </span>
                <span className="font-serif text-[26px] italic text-orange">{s.unit}</span>
              </p>
              <div aria-hidden className="mt-6 min-h-[38px]">
                {s.viz === 'dots' && (
                  <div className="grid grid-cols-[repeat(29,minmax(0,1fr))] gap-[5px]">
                    {Array.from({ length: 58 }, (_, i) => (
                      <span key={i} data-dot className="aspect-square rounded-full bg-orange" />
                    ))}
                  </div>
                )}
                {s.viz === 'roles' && (
                  <div className="grid grid-cols-6 gap-1.5">
                    {ROLE_ICONS.map((Icon, i) => (
                      <span key={i} className="flex flex-col items-center gap-2">
                        <span className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                          <span data-seg className="absolute inset-0 origin-left rounded-full bg-orange rtl:origin-right" />
                        </span>
                        <Icon data-seg-icon className="size-4 text-white/75" strokeWidth={1.75} />
                      </span>
                    ))}
                  </div>
                )}
                {s.viz === 'langs' && (
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'العربية', lang: 'ar' },
                      { label: 'Français', lang: 'fr' },
                      { label: 'English', lang: 'en' },
                    ].map((l) => (
                      <span key={l.lang} lang={l.lang} data-chip className="rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/85">
                        {l.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-5 text-sm text-white/75">{s.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------------ Made for Algeria */

export function MadeForAlgeria() {
  const { t } = useTranslation()
  const glass = 'rounded-card border border-white/90 bg-white/55 p-5 shadow-[0_16px_40px_-16px_rgb(8_26_59/0.2)] backdrop-blur-xl'
  return (
    <section id="built-for-algeria" className="relative scroll-mt-24 overflow-hidden bg-cream-50 py-20 md:py-24" aria-labelledby="algeria-title">
      <div aria-hidden className="pointer-events-none absolute end-[-120px] top-[160px] size-[460px] rounded-full bg-orange/30 blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute start-[25%] top-[120px] size-[380px] rounded-full bg-[#9fb7e6]/40 blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute -start-24 bottom-0 size-[420px] rounded-full bg-orange/25 blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute bottom-[-120px] start-[45%] size-[420px] rounded-full bg-[#9fb7e6]/45 blur-[110px]" />
      <div className="container-page relative">
        <Eyebrow>{t('landing.algeriaEyebrow')}</Eyebrow>
        <h2 id="algeria-title" data-reveal className="mt-6 max-w-[720px] text-[clamp(2.25rem,1.4rem+3vw,3.5rem)] font-light leading-[1.1] tracking-[-0.035em] text-navy-900">
          {t('landing.algeriaTitle')} <span className="font-serif italic text-orange-ink">{t('landing.algeriaAccent')}</span>
        </h2>
        <div className="mt-12 grid gap-4 md:grid-cols-6" data-stagger>
          <article data-stagger-item className={cn(glass, 'md:col-span-4')}>
            <h3 className="text-h3 font-semibold text-navy-900">{t('landing.bentoPayTitle')}</h3>
            <p className="mt-2 text-[13px] text-navy-600">{t('landing.bentoPayBody')}</p>
            <p className="mt-4 flex items-baseline gap-3">
              <span dir="ltr" className="tabular font-stat text-[56px] font-light leading-none text-navy-900">4 500</span>
              <span className="font-serif text-[24px] italic text-orange-ink">{t('common.dzd')}</span>
            </p>
          </article>
          <article data-stagger-item className="rounded-card border border-white/20 bg-[#1b2c4e]/90 p-5 text-white shadow-[0_16px_40px_-16px_rgb(8_26_59/0.4)] backdrop-blur-xl md:col-span-2">
            <h3 className="text-h3 font-semibold">{t('landing.bentoUsedTitle')}</h3>
            <p className="mt-2 text-[13px] text-white/75">{t('landing.bentoUsedBody')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Tag tone="dark">{t('landing.bentoUsed')}</Tag>
              <Tag tone="dark">{t('landing.bentoTested')}</Tag>
              <Tag tone="dark">{t('landing.bentoVerifiedSeller')}</Tag>
            </div>
          </article>
          <article data-stagger-item className={cn(glass, 'md:col-span-2')}>
            <h3 className="text-h3 font-semibold text-navy-900">{t('landing.bentoCodeTitle')}</h3>
            <p className="mt-2 text-[13px] text-navy-600">{t('landing.bentoCodeBody')}</p>
            <p dir="ltr" className="mt-4 text-start font-stat text-[44px] font-light leading-none text-navy-900 rtl:text-end">+213</p>
          </article>
          <article data-stagger-item className="rounded-card border border-white/40 bg-orange-hover/95 p-5 text-white shadow-[0_16px_40px_-16px_rgb(201_79_10/0.5)] backdrop-blur-xl md:col-span-2">
            <h3 className="text-h3 font-semibold">{t('landing.bentoWeekTitle')}</h3>
            <p className="mt-2 text-[13px] text-white/90">{t('landing.bentoWeekBody')}</p>
            <p className="mt-4 font-stat text-[40px] font-light leading-none">{t('landing.bentoWeek')}</p>
          </article>
          <article data-stagger-item lang="ar" dir="rtl" className={cn(glass, 'font-arabic md:col-span-2')}>
            <h3 className="text-h3 font-semibold text-navy-900">{t('landing.bentoArTitle')}</h3>
            <p className="mt-2 text-[13px] text-navy-600">{t('landing.bentoArBody')}</p>
            <div className="mt-4 flex gap-2" dir="ltr">
              {['ع', 'FR', 'EN'].map((l) => (
                <span key={l} className="flex h-7 min-w-9 items-center justify-center rounded-full bg-white px-2 text-[11px] font-semibold text-navy-900 shadow-sm">
                  {l}
                </span>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------- How it works (three ways) */

export function ThreeWays() {
  const { t } = useTranslation()
  const ways = [
    { n: '01', title: t('landing.way1Title'), body: t('landing.way1Body'), tag: t('nav.parts'), to: '/parts' },
    { n: '02', title: t('landing.way2Title'), body: t('landing.way2Body'), tag: t('nav.mechanics'), to: '/mechanics' },
    { n: '03', title: t('landing.way3Title'), body: t('landing.way3Body'), tag: t('nav.sos'), to: '/sos' },
  ]
  return (
    <section className="relative overflow-hidden bg-cream-100 py-20 md:py-24" aria-labelledby="ways-title">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-160px] h-[320px] w-[620px] -translate-x-1/2 rounded-full bg-orange/25 blur-[100px]" />
      <div className="container-page relative text-center">
        <Eyebrow>{t('landing.roadEyebrow')}</Eyebrow>
        <h2 id="ways-title" data-reveal className="mx-auto mt-6 max-w-[860px] text-[clamp(2rem,1.3rem+2.6vw,3.25rem)] font-light leading-[1.15] tracking-[-0.035em] text-navy-900">
          {t('landing.roadTitle')} <span className="font-serif italic text-orange-ink">{t('landing.roadAccent')}</span>
        </h2>
        <p data-reveal className="mx-auto mt-5 max-w-[540px] text-body text-navy-600">
          {t('landing.roadSub')}
        </p>
        <ul className="mt-14 grid gap-5 text-start md:grid-cols-3" data-stagger>
          {ways.map((w) => (
            <li key={w.n} data-stagger-item>
              <Link to={w.to} className="group block h-full rounded-[22px] border border-white bg-white/70 p-6 shadow-[0_18px_40px_-20px_rgb(8_26_59/0.18)] transition-transform duration-300 ease-out hover:-translate-y-1 md:p-9">
                <span aria-hidden className="block h-0.5 w-12 bg-orange" />
                <div className="mt-7 flex items-center justify-between border-b border-grey-200 pb-7">
                  <span className="font-stat text-[44px] font-light leading-none text-orange-ink">{w.n}</span>
                  <span className="flex size-10 items-center justify-center rounded-full bg-orange text-white transition-transform duration-200 ease-out group-hover:scale-105">
                    <img src={arrowLine} alt="" aria-hidden width={14} height={11} className="flip-rtl" />
                  </span>
                </div>
                <h3 className="mt-7 text-[26px] font-normal tracking-[-0.02em] text-navy-900">{w.title}</h3>
                <p className="mt-3 text-sm text-navy-600">{w.body}</p>
                <Tag className="mt-6">{w.tag}</Tag>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ Bento */

export function Bento() {
  const { t } = useTranslation()
  const prices = [
    { s: 'AutoPièces Réghaïa · New', p: 4500 },
    { s: 'Pièces Plus Alger · New', p: 4700 },
    { s: 'Casse Auto Rouiba · Used', p: 1800 },
  ]
  return (
    <section className="bg-cream-50 py-16 md:py-20">
      <div className="container-page grid gap-6 lg:grid-cols-2" data-stagger>
        <article data-stagger-item className="overflow-hidden rounded-lg border border-grey-200 bg-white">
          <img src={mechanicPhoto} alt={t('landing.trustTitle')} loading="lazy" width={1280} height={960} className="h-[260px] w-full object-cover md:h-[320px]" />
          <div className="flex flex-col items-start gap-3 p-6">
            <h3 className="text-h2 font-medium tracking-[-0.035em] text-navy-900">{t('landing.trustTitle')}</h3>
            <p className="text-sm text-navy-600">{t('landing.trustBody')}</p>
            <span className="rounded-sm bg-success-subtle px-2 py-1 text-xs font-medium text-success">{t('landing.trustBadge')}</span>
            <ButtonLink to="/mechanics" variant="secondary" arrow>
              {t('landing.browseMechanics')}
            </ButtonLink>
          </div>
        </article>
        <div className="flex flex-col gap-6">
          <article data-stagger-item className="flex flex-col items-start gap-3 rounded-lg border border-grey-200 bg-[#fff0e6] p-6">
            <h3 className="text-h2 font-medium tracking-[-0.035em] text-navy-900">{t('landing.sosCardTitle')}</h3>
            <p className="text-sm text-navy-600">{t('landing.sosCardBody')}</p>
            <div className="relative flex h-[140px] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-grey-200 bg-info-subtle">
              <span className="relative flex size-5 items-center justify-center">
                <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-orange/50" />
                <img src={pin} alt="" aria-hidden width={20} height={20} className="relative" />
              </span>
              <p className="text-xs text-navy-600">{t('landing.sosMapLabel')}</p>
            </div>
            <ButtonLink to="/sos" variant="accent" arrow>
              {t('landing.callTowNow')}
            </ButtonLink>
          </article>
          <article data-stagger-item className="flex flex-col gap-2 rounded-lg border border-grey-200 bg-white p-6">
            <h3 className="text-h2 font-medium tracking-[-0.035em] text-navy-900">{t('landing.compareTitle')}</h3>
            {prices.map((r) => (
              <div key={r.s} className="flex items-start justify-between gap-4 text-sm">
                <span className="text-navy-600">{r.s}</span>
                <span className="tabular whitespace-nowrap font-medium text-navy-900">{formatDZD(r.p)}</span>
              </div>
            ))}
          </article>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------- FAQ */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <li className="border-b border-grey-200 last:border-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-start text-sm text-navy-900 hover:bg-cream-50"
        >
          {q}
          <Plus aria-hidden className={cn('size-4 shrink-0 text-navy-600 transition-transform duration-200 ease-out', open && 'rotate-45')} />
        </button>
      </h3>
      <div id={id} role="region" className={cn('grid transition-[grid-template-rows] duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <p className={cn('px-4 pb-4 text-sm text-navy-600 transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')}>{a}</p>
        </div>
      </div>
    </li>
  )
}

export function Faq() {
  const { t } = useTranslation()
  return (
    <section id="faq" className="scroll-mt-24 bg-cream-50 pb-20 pt-8" aria-labelledby="faq-title">
      <div className="container-page">
        <h2 id="faq-title" data-reveal className="text-center text-[28px] font-light tracking-[-0.02em] text-navy-900">
          {t('landing.faqTitle')}
        </h2>
        <ul data-reveal className="mx-auto mt-5 max-w-[800px] rounded-lg border border-grey-200 bg-white">
          {[1, 2, 3, 4].map((n) => (
            <FaqItem key={n} q={t(`landing.faq${n}q`)} a={t(`landing.faq${n}a`)} />
          ))}
        </ul>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------- Final CTA */

export function FinalCta() {
  const { t } = useTranslation()
  return (
    <section className="relative overflow-hidden bg-[#0b2a5b] pb-24 pt-16 text-center md:pb-28 md:pt-20" aria-labelledby="cta-title">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[200px] h-[640px] w-[1300px] max-w-none -translate-x-1/2 rounded-[50%] bg-[radial-gradient(100%_100%_at_50%_50%,rgb(242_106_27/0.55),rgb(242_106_27/0.2)_45%,transparent_75%)]" data-cta-glow />
      <div className="container-page relative">
        <h2 id="cta-title" data-reveal className="text-[clamp(2rem,1.2rem+3vw,3.4rem)] font-light tracking-[-0.035em] text-white">
          {t('landing.ctaTitle')}
        </h2>
        <ButtonLink to="/register" variant="accent" arrow className="mt-6" data-reveal>
          {t('landing.ctaButton')}
        </ButtonLink>
      </div>
    </section>
  )
}
