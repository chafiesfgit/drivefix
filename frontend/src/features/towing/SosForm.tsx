import { useMutation } from '@tanstack/react-query'
import { Crosshair, Phone, Siren } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { s4 } from '@/api'
import { isApiError } from '@/api/http'
import { cn } from '@/design/cn'
import { Button, Input, Panel, Select, Textarea } from '@/design/ui'
import { MapView, type LatLng } from '@/design/map/MapView'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/errors'
import { formatDZD, normalizePhone, PHONE_RE } from '@/lib/format'

export const HOTLINE = '+213 555 000 000'
const ALGIERS: LatLng = { lat: 36.7538, lng: 3.0588 }
const ISSUES = ['noStart', 'flat', 'accident', 'overheat', 'battery', 'other'] as const

export function SosForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { role } = useAuth()
  const guest = role !== 'DRIVER'
  const [pos, setPos] = useState<LatLng | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [address, setAddress] = useState('')
  const [destination, setDestination] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [issue, setIssue] = useState<string>('noStart')
  const [details, setDetails] = useState('')
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENT'>('URGENT')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const locate = () => {
    if (!navigator.geolocation) return setGeoError(t('sos.geoUnsupported'))
    setLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude })
        setLocating(false)
      },
      () => {
        setGeoError(t('sos.geoDenied'))
        setPos((cur) => cur ?? ALGIERS)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const create = useMutation({
    mutationFn: () =>
      s4.create({
        pickupLat: pos!.lat,
        pickupLng: pos!.lng,
        pickupAddress: address || undefined,
        destinationAddress: destination || undefined,
        vehicle: vehicle || undefined,
        issue: [t(`sos.issues.${issue}`), details].filter(Boolean).join(' — '),
        urgency,
        guestPhone: guest ? normalizePhone(phone) : undefined,
      }),
    meta: { silent: true },
    onSuccess: (tow) => {
      if (guest) navigate(`/track/${tow.id}?code=${encodeURIComponent(tow.trackingCode)}`)
      else navigate(`/app/driver/sos/${tow.id}`)
    },
  })

  const submit = () => {
    if (guest && !PHONE_RE.test(normalizePhone(phone))) {
      setPhoneError(t('validation.phone'))
      return
    }
    setPhoneError(null)
    create.mutate()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <Panel title={t('sos.whereTitle')} bodyClassName="flex flex-col gap-3">
        <p className="text-sm text-navy-600">{t('sos.whereHelp')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Crosshair className="size-4" aria-hidden />} loading={locating} onClick={locate}>
            {t('sos.useMyLocation')}
          </Button>
          {!pos && (
            <Button variant="secondary" onClick={() => setPos(ALGIERS)}>
              {t('sos.pickOnMap')}
            </Button>
          )}
        </div>
        {geoError && <p role="status" className="text-xs text-warning">{geoError}</p>}
        <MapView center={pos ?? ALGIERS} pickup={pos} onPick={setPos} className="h-[320px] md:h-[420px]" label={t('sos.mapLabel')} />
        {pos && (
          <p dir="ltr" className="tabular text-start text-xs text-navy-600 rtl:text-end">
            {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
          </p>
        )}
      </Panel>

      <Panel title={t('sos.detailsTitle')} className="self-start">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (pos) submit()
          }}
          className="flex flex-col gap-4"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-navy-900">{t('sos.urgency')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['URGENT', 'NORMAL'] as const).map((u) => (
                <button key={u} type="button" aria-pressed={urgency === u} onClick={() => setUrgency(u)} className={cn('pressable rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors', urgency === u ? (u === 'URGENT' ? 'border-orange bg-orange text-white' : 'border-night bg-night text-white') : 'border-grey-200 bg-white text-navy-900')}>
                  {t(`sos.${u.toLowerCase()}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <Input label={t('sos.address')} placeholder={t('sos.addressPh')} value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input label={t('sos.destination')} helper={t('common.optional')} value={destination} onChange={(e) => setDestination(e.target.value)} />
          <Input label={t('mechanics.vehicle')} placeholder={t('landing.vehiclePh')} value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
          <Select label={t('sos.issue')} options={ISSUES.map((i) => ({ value: i, label: t(`sos.issues.${i}`) }))} value={issue} onChange={(e) => setIssue(e.target.value)} />
          <Textarea label={t('sos.moreDetails')} rows={2} maxLength={300} value={details} onChange={(e) => setDetails(e.target.value)} />
          {guest && (
            <Input
              label={t('sos.yourPhone')}
              helper={t('sos.phoneHelp')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              className="text-start rtl:text-end"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={phoneError ?? (create.error && isApiError(create.error) && create.error.field === 'guestPhone' ? errorMessage(t, create.error) : undefined)}
            />
          )}
          <div className="rounded-xl bg-cream-100 p-3 text-sm">
            <p className="font-medium text-navy-900">{t('sos.estimate', { price: formatDZD(3000) })}</p>
            <p className="mt-1 text-xs text-navy-600">{t('sos.estimateHelp')}</p>
          </div>
          {create.error && !(isApiError(create.error) && create.error.field === 'guestPhone') && (
            <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">{errorMessage(t, create.error)}</p>
          )}
          <Button type="submit" variant="accent" arrow size="lg" loading={create.isPending} disabled={!pos} icon={<Siren className="size-5" aria-hidden />}>
            {t('sos.send')}
          </Button>
          {!pos && <p className="text-xs text-navy-600">{t('sos.needPosition')}</p>}
          <a href={`tel:${HOTLINE.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline">
            <Phone className="size-4" aria-hidden />
            {t('sos.hotline')} <span dir="ltr">{HOTLINE}</span>
          </a>
        </form>
      </Panel>
    </div>
  )
}
