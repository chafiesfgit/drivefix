import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { cn } from '../cn'

export interface LatLng {
  lat: number
  lng: number
}

/** Leaflet's default PNG icons break with bundlers: use small HTML markers instead. */
const pickupIcon = L.divIcon({
  className: '',
  html: '<span style="position:relative;display:block;width:22px;height:22px"><span style="position:absolute;inset:0;border-radius:999px;background:rgba(242,106,27,.3)"></span><span style="position:absolute;inset:5px;border-radius:999px;background:#F26A1B;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const truckIcon = L.divIcon({
  className: '',
  html: '<span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:#0B2A5B;border:2px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.35)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

const pinIcon = L.divIcon({
  className: '',
  html: '<span style="display:block;width:16px;height:16px;border-radius:999px;background:#1F4E9E;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap()
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|')
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 14), { animate: false })
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 15, animate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

function ClickToPick({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

/** OpenStreetMap via Leaflet. Animated marker moves are smoothed with CSS on the marker pane. */
export function MapView({
  center,
  pickup,
  truck,
  trail,
  points,
  onPick,
  className,
  label,
  fit = true,
}: {
  center: LatLng
  pickup?: LatLng | null
  truck?: LatLng | null
  trail?: LatLng[]
  points?: (LatLng & { id: string })[]
  onPick?: (p: LatLng) => void
  className?: string
  label?: string
  fit?: boolean
}) {
  const { t } = useTranslation()
  const fitPoints = useMemo(() => [pickup, truck].filter((p): p is LatLng => Boolean(p)), [pickup, truck])
  return (
    <div className={cn('relative overflow-hidden rounded-lg border border-grey-200 bg-info-subtle', className)} role="region" aria-label={label ?? t('map.label')}>
      <MapContainer center={[center.lat, center.lng]} zoom={13} scrollWheelZoom={false} className="size-full min-h-[inherit]" attributionControl>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {trail && trail.length > 1 && <Polyline positions={trail.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#0B2A5B', weight: 4, opacity: 0.55, dashArray: '6 8' }} />}
        {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} interactive={false} keyboard={false} title={t('map.pickup')} />}
        {truck && <Marker position={[truck.lat, truck.lng]} icon={truckIcon} interactive={false} keyboard={false} title={t('map.truck')} />}
        {points?.map((p) => <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon} interactive={false} keyboard={false} title={t('map.point')} />)}
        {fit && <FitBounds points={fitPoints.length ? fitPoints : [center]} />}
        {onPick && <ClickToPick onPick={onPick} />}
      </MapContainer>
    </div>
  )
}
