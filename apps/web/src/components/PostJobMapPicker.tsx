import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { WORKER_REFERENCE } from "../lib/geo"

const DEFAULT_CENTER: [number, number] = [WORKER_REFERENCE.lat, WORKER_REFERENCE.lng]
const DEFAULT_ZOOM = 13

const pinIcon = L.divIcon({
  className: "ocap-leaflet-pin",
  html: `<div style="width:32px;height:32px;transform:translate(-50%,-100%);pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))"><svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 109.5 9 2.5 2.5 0 0012 11.5z" fill="#E0FF00" stroke="#000" stroke-width="0.75"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true })
  }, [lat, lng, map])
  return null
}

function SetupAutoLocation({
  hasPin,
  onPick,
}: {
  hasPin: boolean
  onPick: (lat: number, lng: number) => void
}) {
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    if (hasPin) return
    attempted.current = true

    if (!("geolocation" in navigator)) {
      onPick(WORKER_REFERENCE.lat, WORKER_REFERENCE.lng)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPick(pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        onPick(WORKER_REFERENCE.lat, WORKER_REFERENCE.lng)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
    )
  }, [hasPin, onPick])

  return null
}

export type PostJobMapPickerProps = {
  latStr: string
  lngStr: string
  onPick: (lat: number, lng: number) => void
}

export function PostJobMapPicker({
  latStr,
  lngStr,
  onPick,
}: PostJobMapPickerProps) {
  const { hasPin, lat, lng } = useMemo(() => {
    const la = parseFloat(latStr)
    const ln = parseFloat(lngStr)
    const ok = Number.isFinite(la) && Number.isFinite(ln)
    return { hasPin: ok, lat: la, lng: ln }
  }, [latStr, lngStr])

  const [locating, setLocating] = useState(false)
  const lastManualPickAt = useRef(0)

  const onManualPick = useCallback(
    (la: number, ln: number) => {
      lastManualPickAt.current = Date.now()
      onPick(la, ln)
    },
    [onPick],
  )

  const recenterToCurrent = useCallback(() => {
    if (!("geolocation" in navigator)) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        onManualPick(pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    )
  }, [onManualPick])

  return (
    <div className="relative z-0 h-[220px] w-full overflow-hidden rounded-ocap-post [&_.leaflet-container]:h-[220px] [&_.leaflet-container]:w-full [&_.leaflet-control-attribution]:text-[10px]">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-[220px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <SetupAutoLocation hasPin={hasPin} onPick={onPick} />
        <MapClickHandler onPick={onManualPick} />
        {hasPin ? (
          <>
            <Recenter lat={lat} lng={lng} />
            <Marker
              position={[lat, lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as { getLatLng: () => { lat: number; lng: number } }
                  const p = m.getLatLng()
                  onManualPick(p.lat, p.lng)
                },
              }}
            />
          </>
        ) : null}
      </MapContainer>
      <button
        type="button"
        onClick={recenterToCurrent}
        className="absolute right-2 top-2 z-[500] rounded bg-black/90 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-ocap-lime-post"
      >
        {locating ? "Locating…" : "Use my location"}
      </button>
      <p className="pointer-events-none absolute bottom-8 left-2 right-2 z-[400] rounded bg-white/90 px-2 py-1 text-center text-[9px] font-bold uppercase tracking-wide text-neutral-700 shadow-sm">
        Auto-detected pin • drag to adjust or tap the map to move (free — OpenStreetMap)
      </p>
    </div>
  )
}
