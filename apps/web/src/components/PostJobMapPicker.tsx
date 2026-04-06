import { useCallback, useEffect, useMemo } from "react"
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

const DEFAULT_CENTER: [number, number] = [28.7075, 77.1025]
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
  const onMapClick = useCallback(
    (lat: number, lng: number) => {
      onPick(lat, lng)
    },
    [onPick],
  )

  const { hasPin, lat, lng } = useMemo(() => {
    const la = parseFloat(latStr)
    const ln = parseFloat(lngStr)
    const ok = Number.isFinite(la) && Number.isFinite(ln)
    return { hasPin: ok, lat: la, lng: ln }
  }, [latStr, lngStr])

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
        <MapClickHandler onPick={onMapClick} />
        {hasPin ? (
          <>
            <Recenter lat={lat} lng={lng} />
            <Marker position={[lat, lng]} icon={pinIcon} />
          </>
        ) : null}
      </MapContainer>
      <p className="pointer-events-none absolute bottom-8 left-2 right-2 z-[400] rounded bg-white/90 px-2 py-1 text-center text-[9px] font-bold uppercase tracking-wide text-neutral-700 shadow-sm">
        Tap or click the map to place the site pin (free — OpenStreetMap)
      </p>
    </div>
  )
}
