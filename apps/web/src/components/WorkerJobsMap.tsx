import { useEffect, useMemo } from "react"
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { JobWithHirer } from "../types/job"
import { parseGeographyPoint, WORKER_REFERENCE } from "../lib/geo"

function jobMarkerIcon(selected: boolean) {
  const s = selected ? 44 : 38
  const bw = selected ? 3 : 2
  return L.divIcon({
    className: "ocap-leaflet-pin",
    html: `<div style="width:${s}px;height:${s}px;background:#E2FF00;border:${bw}px solid #000;border-radius:4px;box-shadow:3px 3px 0 #000;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#000;text-align:center;line-height:1.05;padding:2px">JOB</div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s],
  })
}

const userLocationIcon = L.divIcon({
  className: "ocap-user-loc-pin",
  html: `<div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;pointer-events:none">
    <div class="ocap-map-user-pulse" style="position:absolute;width:14px;height:14px;border-radius:50%;background:#3B82F6;left:50%;top:50%;margin-left:-7px;margin-top:-7px"></div>
    <div style="position:relative;width:6px;height:6px;border-radius:50%;background:#fff;border:1px solid #3B82F6;z-index:2"></div>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

function MapViewController({
  jobPositions,
  userPos,
  centerOnUser,
}: {
  jobPositions: [number, number][]
  userPos: { lat: number; lng: number } | null
  centerOnUser: boolean
}) {
  const map = useMap()

  useEffect(() => {
    if (centerOnUser && userPos) {
      map.setView([userPos.lat, userPos.lng], 13)
      console.log("[Map] Centered on user:", userPos)
      return
    }
    if (jobPositions.length === 0) {
      map.setView([WORKER_REFERENCE.lat, WORKER_REFERENCE.lng], 11)
      return
    }
    if (jobPositions.length === 1) {
      map.setView(jobPositions[0], 13)
      return
    }
    map.fitBounds(L.latLngBounds(jobPositions), {
      padding: [52, 52],
      maxZoom: 14,
    })
  }, [map, jobPositions, userPos, centerOnUser])

  return null
}

export type WorkerJobsMapProps = {
  jobs: JobWithHirer[]
  selectedId: string | null
  onSelectJob: (jobId: string) => void
  /** Real device position when permission granted; omit marker when null. */
  userMarkerPosition?: { lat: number; lng: number } | null
  /** When true, map prioritizes centering on user over job bounds. */
  centerOnUser?: boolean
}

export function WorkerJobsMap({
  jobs,
  selectedId,
  onSelectJob,
  userMarkerPosition,
  centerOnUser = false,
}: WorkerJobsMapProps) {
  const markers = useMemo(() => {
    const out: {
      job: JobWithHirer
      lat: number
      lng: number
    }[] = []
    for (const job of jobs) {
      const pt = parseGeographyPoint(job.location)
      if (pt) out.push({ job, lat: pt.lat, lng: pt.lng })
    }
    return out
  }, [jobs])

  const positions = useMemo(
    () => markers.map((m) => [m.lat, m.lng] as [number, number]),
    [markers],
  )

  const defaultCenter: [number, number] = [
    WORKER_REFERENCE.lat,
    WORKER_REFERENCE.lng,
  ]

  return (
    <div className="relative z-0 h-full min-h-[400px] w-full [&_.leaflet-container]:z-0 [&_.leaflet-container]:h-full [&_.leaflet-container]:min-h-[400px] [&_.leaflet-container]:w-full [&_.leaflet-control-attribution]:text-[10px]">
      <MapContainer
        center={defaultCenter}
        zoom={11}
        scrollWheelZoom
        className="h-full min-h-[400px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewController
          jobPositions={positions}
          userPos={userMarkerPosition ?? null}
          centerOnUser={centerOnUser}
        />
        {markers.map(({ job, lat, lng }) => (
          <Marker
            key={`${job.id}-${job.id === selectedId ? "sel" : "n"}`}
            position={[lat, lng]}
            icon={jobMarkerIcon(job.id === selectedId)}
            eventHandlers={{
              click: () => {
                onSelectJob(job.id)
              },
            }}
          />
        ))}
        {userMarkerPosition ? (
          <Marker
            position={[userMarkerPosition.lat, userMarkerPosition.lng]}
            icon={userLocationIcon}
            zIndexOffset={1000}
          >
            <Tooltip
              direction="top"
              offset={[0, -8]}
              opacity={1}
              permanent
              className="!rounded-sm !border !border-black !bg-black !px-2 !py-1 !text-[9px] !font-extrabold !uppercase !text-white"
            >
              You are here
            </Tooltip>
          </Marker>
        ) : null}
      </MapContainer>
      <p className="pointer-events-none absolute bottom-8 left-2 right-2 z-[400] rounded bg-white/90 px-2 py-1 text-center text-[9px] font-bold uppercase tracking-wide text-neutral-600 shadow-sm md:bottom-2">
        Pins = active jobs from hirers (Supabase) · Tap a pin for details
      </p>
    </div>
  )
}
