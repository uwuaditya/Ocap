import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"
import { useWorkerJobs } from "../../worker/WorkerJobsContext"
import { WorkerJobsMap } from "../WorkerJobsMap"
import type { JobWithHirer } from "../../types/job"
import { mapDurationLabel } from "../../lib/jobDisplay"
import {
  getDistanceKm,
  parseGeographyPoint,
  WORKER_REFERENCE,
} from "../../lib/geo"
import {
  persistLocationDenied,
  persistLocationGranted,
  readLocationDenied,
  readLocationGranted,
} from "../../lib/ocapLocationStorage"
import { reverseGeocodeArea } from "../../lib/reverseGeocode"

const PinSm = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
      fill="currentColor"
    />
  </svg>
)

const ListIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" fill="currentColor" />
  </svg>
)

const MapGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5z"
      fill="currentColor"
    />
  </svg>
)

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
      fill="#3D4F1F"
    />
  </svg>
)

const FilterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" fill="currentColor" />
  </svg>
)

const BuildingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"
      fill="currentColor"
    />
  </svg>
)

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor" />
  </svg>
)

const ShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"
      fill="currentColor"
    />
  </svg>
)

function pickDefaultJob(jobs: JobWithHirer[]): JobWithHirer | null {
  if (!jobs.length) return null
  const brick = jobs.find((j) => j.title.toLowerCase().includes("bricklayer"))
  if (brick) return brick
  const urgent = jobs.find((j) => j.is_urgent)
  return urgent ?? jobs[0]
}

type LocationStatus = "pending" | "granted" | "denied" | "skipped"

export function MapScreen() {
  const { jobs, loading, error, missingConfig, reload } = useWorkerJobs()
  const { user } = useUser()
  const [userLocation, setUserLocation] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>("pending")
  const [showLocationBanner, setShowLocationBanner] = useState(false)
  const [locationLabel, setLocationLabel] = useState("ROHINI, DL")

  const requestDeviceLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      console.log("[Map] Geolocation API not available")
      setLocationStatus("denied")
      setUserLocation(WORKER_REFERENCE)
      persistLocationDenied()
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
        console.log("[Map] Geolocation granted:", loc)
        setUserLocation(loc)
        setLocationStatus("granted")
        persistLocationGranted()
      },
      (err) => {
        console.log("[Map] Geolocation denied:", err)
        setLocationStatus("denied")
        setUserLocation(WORKER_REFERENCE)
        persistLocationDenied()
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  useEffect(() => {
    const granted = readLocationGranted()
    const denied = readLocationDenied()
    console.log("[Map] Mount location prefs:", { granted, denied })

    if (granted) {
      setShowLocationBanner(false)
      setLocationStatus("pending")
      requestDeviceLocation()
      return
    }
    if (denied) {
      setShowLocationBanner(false)
      setUserLocation(WORKER_REFERENCE)
      setLocationStatus("skipped")
      console.log("[Map] Using Rohini (stored denied/skip)")
      return
    }
    setShowLocationBanner(true)
    setLocationStatus("pending")
    setUserLocation(null)
  }, [requestDeviceLocation])

  const filterRef = userLocation ?? WORKER_REFERENCE

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      const pt = parseGeographyPoint(j.location)
      if (!pt) return false
      const d = getDistanceKm(filterRef.lat, filterRef.lng, pt.lat, pt.lng)
      return d <= 50
    })
  }, [jobs, filterRef.lat, filterRef.lng])

  const defaultJob = useMemo(
    () => pickDefaultJob(filteredJobs),
    [filteredJobs],
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!filteredJobs.length) {
      setSelectedId(null)
      return
    }
    setSelectedId((prev) => {
      if (prev && filteredJobs.some((j) => j.id === prev)) return prev
      return pickDefaultJob(filteredJobs)?.id ?? filteredJobs[0]?.id ?? null
    })
  }, [filteredJobs])

  useEffect(() => {
    let cancelled = false
    setLocationLabel("LOCATING...")
    reverseGeocodeArea(filterRef.lat, filterRef.lng)
      .then((area) => {
        if (cancelled) return
        setLocationLabel(area)
        console.log("[Map] Reverse geocode label:", area)
      })
      .catch((e) => {
        console.log("[Map] Reverse geocode failed:", e)
        if (!cancelled) setLocationLabel("ROHINI, DL")
      })
    return () => {
      cancelled = true
    }
  }, [filterRef.lat, filterRef.lng])

  const effectiveId =
    selectedId ?? defaultJob?.id ?? filteredJobs[0]?.id ?? null
  const selected = effectiveId
    ? filteredJobs.find((j) => j.id === effectiveId) ?? null
    : null

  const panelDistance = selected
    ? (() => {
        const pt = parseGeographyPoint(selected.location)
        if (!pt) return "—"
        return (
          getDistanceKm(
            filterRef.lat,
            filterRef.lng,
            pt.lat,
            pt.lng,
          ).toFixed(1) + " KM"
        )
      })()
    : "—"

  const userMarkerPosition =
    locationStatus === "granted" && userLocation ? userLocation : null
  const centerOnUser = locationStatus === "granted" && Boolean(userLocation)
  const duration = selected ? mapDurationLabel(selected.description) : "—"
  const hirerName = selected?.hirer?.name?.trim() || ""
  const rateMain =
    selected?.is_fixed_rate && selected.fixed_rate != null
      ? `₹${Number(selected.fixed_rate).toLocaleString("en-IN")}`
      : selected?.hourly_rate != null
        ? `₹${Number(selected.hourly_rate)}`
        : "—"
  const rateSub = selected?.is_fixed_rate ? "Fixed" : "Per hour"

  return (
    <div className="relative flex min-h-screen flex-col bg-ocap-map-page">
      <header className="flex items-center justify-between px-ocap-x pb-2 pt-3">
        <div className="flex items-center gap-1 font-black uppercase text-ocap-black">
          <PinSm />
          <span className="text-[17px]">OCAP</span>
        </div>
        <div className="flex">
          <button
            type="button"
            className="flex items-center gap-2 border border-ocap-black bg-ocap-lime-map px-3 py-2 text-[11px] font-extrabold uppercase text-ocap-black"
          >
            <MapGlyph />
            Map
          </button>
          <Link
            to="/worker/feed"
            className="flex items-center gap-2 border border-l-0 border-ocap-black bg-ocap-map-toggleInactive px-3 py-2 text-[11px] font-extrabold uppercase text-ocap-black"
          >
            <ListIcon />
            List
          </Link>
        </div>
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-sm border border-ocap-black object-cover"
          />
        ) : (
          <div
            className="h-10 w-10 shrink-0 border border-ocap-black"
            aria-label="Profile"
            style={{ background: "#14B8A6" }}
          />
        )}
      </header>

      <div className="px-ocap-x pt-1">
        <div className="flex items-center gap-3 border border-ocap-black bg-ocap-white px-3 py-3 shadow-ocap-search">
          <SearchIcon />
          <span className="flex-1 text-[14px] font-medium text-ocap-map-muted">
            Search jobs near {locationLabel}
          </span>
          <FilterIcon />
        </div>
      </div>

      <div className="relative mt-3 flex min-h-[400px] flex-1 flex-col md:flex-row">
        <div className="relative z-0 flex min-h-[400px] flex-1 flex-col bg-ocap-map-page">
          {missingConfig && (
            <div className="absolute left-ocap-x top-4 z-[5] text-[12px] text-ocap-black">
              Configure Supabase env to see the map.
            </div>
          )}
          {error && (
            <div className="absolute left-ocap-x right-ocap-x top-4 z-[5] rounded border border-red-200 bg-red-50 p-2 text-[12px] text-red-800">
              {error.message}
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => void reload()}
              >
                Retry
              </button>
            </div>
          )}
          {!missingConfig ? (
            <>
              {showLocationBanner ? (
                <div
                  className="absolute left-0 right-0 top-0 z-[600] flex items-center gap-3 border-l-4 border-ocap-lime-map bg-black p-3 text-white"
                  role="dialog"
                  aria-label="Location permission"
                >
                  <span className="shrink-0 text-lg" aria-hidden>
                    📍
                  </span>
                  <p className="min-w-0 flex-1 text-[12px] font-semibold leading-snug">
                    Allow location access to see jobs near you
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="!min-h-0 border-0 bg-ocap-lime-map px-3 py-1.5 text-[10px] font-extrabold uppercase text-ocap-black"
                      onClick={() => {
                        console.log("[Map] Location banner: ALLOW")
                        setShowLocationBanner(false)
                        requestDeviceLocation()
                      }}
                    >
                      ALLOW
                    </button>
                    <button
                      type="button"
                      className="!min-h-0 border border-white/20 bg-neutral-900 px-3 py-1.5 text-[10px] font-extrabold uppercase text-white"
                      onClick={() => {
                        console.log("[Map] Location banner: SKIP")
                        setShowLocationBanner(false)
                        setUserLocation(WORKER_REFERENCE)
                        setLocationStatus("skipped")
                        persistLocationDenied()
                      }}
                    >
                      SKIP
                    </button>
                  </div>
                </div>
              ) : null}
              <WorkerJobsMap
                jobs={filteredJobs}
                selectedId={effectiveId}
                onSelectJob={setSelectedId}
                userMarkerPosition={userMarkerPosition}
                centerOnUser={centerOnUser}
              />
              {loading ? (
                <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-white/70 text-[12px] font-bold uppercase text-ocap-map-muted">
                  Loading jobs…
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-[1100] border-t border-ocap-black bg-ocap-white md:static md:z-auto md:w-[30%] md:min-w-[340px] md:border-l md:border-t-0 md:overflow-y-auto">
          <div className="h-1.5 bg-ocap-lime-map" />
          {!selected ? (
            <div className="p-ocap-card text-ocap-meta text-ocap-map-muted">
              No job selected
            </div>
          ) : (
            <div className="p-ocap-card">
              <div className="flex justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {selected.is_urgent ? (
                    <div className="inline-block border border-ocap-black bg-ocap-black px-2 py-1">
                      <span className="text-[9px] font-extrabold uppercase text-ocap-lime-map">
                        Urgent requirement
                      </span>
                    </div>
                  ) : null}
                  <h2 className="text-ocap-map-title mt-3 uppercase text-ocap-black">
                    {selected.title}
                  </h2>
                  <div className="mt-2 flex items-center gap-2 text-ocap-map-muted">
                    <BuildingIcon />
                    {hirerName ? (
                      <span className="text-[13px] font-semibold">{hirerName}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center border border-ocap-black bg-ocap-lime-map text-ocap-black">
                  <span className="text-[20px] font-black leading-none">
                    {rateMain}
                  </span>
                  <span className="mt-1 text-[9px] font-extrabold uppercase">
                    {rateSub}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 border border-ocap-map-divider">
                <div className="border-r border-ocap-map-divider p-3">
                  <div className="text-ocap-label text-ocap-map-muted">
                    Distance
                  </div>
                  <div className="text-[17px] font-black text-ocap-black">
                    {panelDistance}
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-ocap-label text-ocap-map-muted">
                    Duration
                  </div>
                  <div className="text-[17px] font-black text-ocap-black">
                    {duration}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <Link
                  to={`/worker/job/${selected.id}`}
                  className="flex flex-1 items-center justify-center gap-2 border border-ocap-black bg-ocap-lime-map py-3.5 text-ocap-btn uppercase text-ocap-black"
                >
                  <SendIcon />
                  Request job
                </Link>
                <button
                  type="button"
                  className="flex h-[48px] w-[52px] shrink-0 items-center justify-center border border-ocap-black bg-ocap-map-share"
                >
                  <ShareIcon />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
