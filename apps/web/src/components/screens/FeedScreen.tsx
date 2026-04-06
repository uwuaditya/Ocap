import { Link } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"
import {
  feedScheduleLine,
  formatKmAway,
  isFixedRate,
  jobDistanceKm,
  rateBadgeText,
} from "../../lib/jobDisplay"
import type { JobWithHirer } from "../../types/job"
import { fetchActiveJobs } from "../../lib/jobs"
import { isSupabaseConfigured } from "../../lib/supabase"
import { WORKER_REFERENCE } from "../../lib/geo"
import { readLocationDenied } from "../../lib/ocapLocationStorage"
import { reverseGeocodeArea } from "../../lib/reverseGeocode"

const Pin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"
      fill="currentColor"
    />
  </svg>
)

const Cal = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7v-5z"
      fill="currentColor"
    />
  </svg>
)

const Clock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2z m-.01 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
      fill="currentColor"
    />
  </svg>
)

const Verified = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="10" fill="#1D9BF0" />
    <path
      d="M10.5 14.2l-2.1-2.1-.9.9 3 3 6-6-.9-.9-5.1 5.1z"
      fill="#fff"
    />
  </svg>
)

function GigCardStandard({
  job,
  distanceRef,
}: {
  job: JobWithHirer
  distanceRef: { lat: number; lng: number }
}) {
  const km = jobDistanceKm(job, distanceRef)
  const sched = feedScheduleLine(job)
  const hirerName = job.hirer?.name ?? "Employer"
  return (
    <article className="rounded-ocap-feed-card border border-black/[0.06] bg-ocap-feed-card p-ocap-card">
      <div className="flex items-start justify-between gap-3">
        <h2 className="max-w-[220px] text-ocap-card-title uppercase text-ocap-black">
          {job.title}
        </h2>
        <div className="shrink-0 bg-ocap-lime-feed px-2.5 py-1.5 text-ocap-btn text-ocap-black">
          {rateBadgeText(job)}
        </div>
      </div>
      <div className="mt-3 flex gap-6">
        <div className="flex items-center gap-1.5 text-ocap-feed-meta">
          <Pin />
          <span className="text-ocap-meta uppercase">{formatKmAway(km)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-ocap-feed-meta">
          {sched.icon === "cal" ? <Cal /> : <Clock />}
          <span className="text-ocap-meta uppercase">{sched.text}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 rounded-sm bg-zinc-300" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-[15px] font-extrabold text-ocap-black">
              {hirerName}
            </span>
            <Verified />
          </div>
          <p className="text-ocap-sub mt-0.5 uppercase text-ocap-feed-meta">
            Verified employer • 4.9 rating
          </p>
        </div>
      </div>
      <Link
        to={`/worker/job/${job.id}`}
        className="mt-4 flex w-full items-center justify-center bg-ocap-lime-feed py-3.5 text-ocap-btn uppercase text-ocap-black"
      >
        Request job
      </Link>
    </article>
  )
}

function GigCardUrgent({
  job,
  distanceRef,
}: {
  job: JobWithHirer
  distanceRef: { lat: number; lng: number }
}) {
  const km = jobDistanceKm(job, distanceRef)
  const sched = feedScheduleLine(job)
  const hirerName = job.hirer?.name ?? "Employer"
  const fixed = isFixedRate(job)
  return (
    <article className="relative rounded-ocap-feed-card bg-ocap-feed-urgent p-ocap-card">
      <div className="absolute right-ocap-card top-ocap-card bg-ocap-lime-feed px-3 py-1">
        <span className="text-ocap-meta font-extrabold uppercase text-ocap-black">
          Urgent
        </span>
      </div>
      <div className="flex items-start justify-between gap-3 pr-24">
        <h2 className="max-w-[200px] text-ocap-card-title uppercase text-ocap-white">
          {job.title}
        </h2>
        {!fixed && (
          <div className="shrink-0 bg-ocap-lime-feed px-2.5 py-1.5 text-ocap-btn text-ocap-black">
            {rateBadgeText(job)}
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-6 text-ocap-white">
        <div className="flex items-center gap-1.5">
          <Pin />
          <span className="text-ocap-meta uppercase">{formatKmAway(km)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {sched.icon === "cal" ? <Cal /> : <Clock />}
          <span className="text-ocap-meta uppercase">{sched.text}</span>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-sm bg-zinc-600" />
        <div className="min-w-0 flex-1">
          <span className="text-[15px] font-extrabold text-ocap-white">
            {hirerName}
          </span>
        </div>
      </div>
      {fixed ? (
        <div className="mt-2 flex flex-col items-end">
          <span className="text-ocap-sub uppercase text-ocap-white">
            Fixed rate
          </span>
          <span className="text-ocap-price-lg text-ocap-lime-feed">
            {rateBadgeText(job)}
          </span>
        </div>
      ) : null}
      <Link
        to={`/worker/job/${job.id}`}
        className="mt-4 flex w-full items-center justify-center bg-ocap-lime-feed py-3.5 text-ocap-btn uppercase text-ocap-black"
      >
        Request job
      </Link>
    </article>
  )
}

type FilterType = "ALL" | "NEARBY" | "TODAY" | "₹/HR"

export function FeedScreen() {
  const filters: FilterType[] = ["ALL", "NEARBY", "TODAY", "₹/HR"]
  const [allJobs, setAllJobs] = useState<JobWithHirer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL")
  const [userLocation, setUserLocation] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [locationLabel, setLocationLabel] = useState("ROHINI, DL")
  const missingConfig = !isSupabaseConfigured()

  const distanceRef = userLocation ?? WORKER_REFERENCE

  useEffect(() => {
    if (readLocationDenied()) {
      console.log("[Feed] Stored location denied/skip — using Rohini, no prompt")
      setUserLocation(WORKER_REFERENCE)
      return
    }
    if (!("geolocation" in navigator)) {
      console.log("[Feed] Geolocation not available — Rohini fallback")
      setUserLocation(WORKER_REFERENCE)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
        console.log("[Feed] Geolocation success:", loc)
        setUserLocation(loc)
      },
      (err) => {
        console.log("[Feed] Geolocation error — Rohini fallback:", err)
        setUserLocation(WORKER_REFERENCE)
      },
    )
  }, [])

  useEffect(() => {
    if (!userLocation) return
    let cancelled = false
    setLocationLabel("LOCATING...")
    reverseGeocodeArea(userLocation.lat, userLocation.lng)
      .then((area) => {
        if (cancelled) return
        setLocationLabel(area)
        console.log("[Feed] Reverse geocode label:", area)
      })
      .catch((e) => {
        console.log("[Feed] Reverse geocode failed:", e)
        if (!cancelled) setLocationLabel("ROHINI, DL")
      })
    return () => {
      cancelled = true
    }
  }, [userLocation])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!isSupabaseConfigured()) {
        setAllJobs([])
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const { data, error: fetchErr } = await fetchActiveJobs()

      if (cancelled) return

      if (fetchErr) {
        setError(fetchErr)
        setAllJobs([])
      } else {
        setError(null)
        setAllJobs(data ?? [])
      }

      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const displayedJobs = useMemo(() => {
    const result = [...allJobs]

    switch (activeFilter) {
      case "NEARBY":
        result.sort((a, b) => {
          const da = jobDistanceKm(a, distanceRef) ?? Infinity
          const db = jobDistanceKm(b, distanceRef) ?? Infinity
          return da - db
        })
        break

      case "TODAY": {
        const today = new Date().toISOString().slice(0, 10)
        return result.filter((j) => j.start_date === today)
      }

      case "₹/HR":
        result.sort((a, b) => {
          const ra = Number(a.hourly_rate) || 0
          const rb = Number(b.hourly_rate) || 0
          return rb - ra
        })
        break
    }

    return result
  }, [allJobs, activeFilter, distanceRef])

  return (
    <div className="relative flex min-h-screen flex-col bg-ocap-feed-page">
      <header className="flex items-center justify-between px-ocap-x pt-3">
        <span className="text-[18px] font-black uppercase tracking-tight text-ocap-black">
          OCAP
        </span>
        <div className="flex items-center gap-1.5 rounded-sm bg-ocap-feed-location px-3 py-2">
          <Pin />
          <span className="text-ocap-meta font-extrabold uppercase text-ocap-black">
            {locationLabel}
          </span>
        </div>
        <div
          className="h-10 w-10 shrink-0 rounded-sm"
          style={{ background: "#FFD4B8" }}
          aria-label="Profile"
        />
      </header>

      <div className="mt-6 px-ocap-x">
        <h1 className="text-ocap-title font-black uppercase text-ocap-black">
          Available Gigs
        </h1>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto px-ocap-x pb-1">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFilter(f)}
            className={`shrink-0 rounded-ocap-feed-chip px-4 py-2.5 text-ocap-btn uppercase ${
              f === activeFilter
                ? "bg-ocap-lime-feed text-ocap-black"
                : "bg-ocap-feed-chipInactive text-ocap-feed-chipText"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <main className="mt-ocap-y flex flex-1 flex-col gap-4 overflow-y-auto px-ocap-x pb-4 md:grid md:grid-cols-2 md:items-start">
        {missingConfig && (
          <p className="text-ocap-meta text-ocap-feed-meta md:col-span-2">
            Set{" "}
            <code className="text-ocap-black">VITE_SUPABASE_URL</code> and{" "}
            <code className="text-ocap-black">VITE_SUPABASE_ANON_KEY</code> in{" "}
            <code className="text-ocap-black">apps/web/.env</code> to load gigs.
          </p>
        )}
        {error && (
          <div className="rounded-ocap-feed-card border border-red-200 bg-red-50 p-ocap-card text-[13px] text-red-800 md:col-span-2">
            {error.message}
          </div>
        )}
        {loading && !missingConfig && (
          <div className="flex items-center gap-2 text-ocap-meta uppercase text-ocap-feed-meta md:col-span-2">
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeOpacity="0.25"
                strokeWidth="4"
              />
              <path
                d="M22 12a10 10 0 0 0-10-10"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
            <span>Loading gigs…</span>
          </div>
        )}
        {!loading && displayedJobs.length === 0 && !missingConfig && !error && (
          <p className="text-ocap-meta uppercase text-ocap-feed-meta md:col-span-2">
            {activeFilter === "TODAY"
              ? "No gigs starting today"
              : "No gigs found"}
          </p>
        )}
        {!loading &&
          displayedJobs.map((job) =>
            job.is_urgent ? (
              <GigCardUrgent
                key={job.id}
                job={job}
                distanceRef={distanceRef}
              />
            ) : (
              <GigCardStandard
                key={job.id}
                job={job}
                distanceRef={distanceRef}
              />
            ),
          )}
      </main>
    </div>
  )
}
