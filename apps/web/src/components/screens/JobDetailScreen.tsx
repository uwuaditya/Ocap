import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"
import { fetchJobById } from "../../lib/jobs"
import {
  isFixedRate,
} from "../../lib/jobDisplay"
import type { ApplicationRow, JobWithHirer } from "../../types/job"
import { isSupabaseConfigured, supabase } from "../../lib/supabase"
import {
  distanceKm,
  getTimeUntil,
  parseGeographyPoint,
  WORKER_REFERENCE,
} from "../../lib/geo"

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const a = parts[0]?.[0] ?? ""
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  return (a + b).toUpperCase() || "—"
}

function cityFromAddress(address: string | null): string {
  const a = (address ?? "").trim()
  if (!a) return "—"
  const parts = a
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
  if (parts.length === 1) return parts[0]!
  return parts[parts.length - 2] ?? parts[parts.length - 1] ?? "—"
}

function Badge({
  children,
  variant,
}: {
  children: string
  variant: "urgent" | "status"
}) {
  const cls =
    variant === "urgent" ? "bg-black text-[#E2FF00]" : "bg-black text-white"
  return (
    <span
      className={`${cls} inline-flex items-center px-2 py-1 text-[10px] font-extrabold uppercase`}
      style={{ letterSpacing: "1px" }}
    >
      {children}
    </span>
  )
}

function VerifiedCheck() {
  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black text-[#E2FF00]"
      aria-label="Verified"
      title="Verified"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M10.5 14.2l-2.1-2.1-.9.9 3 3 6-6-.9-.9-5.1 5.1z"
          fill="currentColor"
        />
      </svg>
    </span>
  )
}

function NavigateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"
        fill="currentColor"
      />
    </svg>
  )
}

function formatStartDate(d: string | null): string {
  if (!d) return "—"
  try {
    const x = new Date(`${d}T12:00:00`)
    return x.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return d
  }
}

function formatShift(t: string | null): string {
  if (!t) return "—"
  const parts = t.split(":")
  const hh = parseInt(parts[0] ?? "", 10)
  const mm = (parts[1] ?? "00").slice(0, 2)
  if (Number.isNaN(hh)) return t
  const h12 = hh % 12 || 12
  const ampm = hh < 12 ? "am" : "pm"
  return `${h12}:${mm.padStart(2, "0")} ${ampm}`
}

export function JobDetailScreen() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { user, isLoaded: userLoaded } = useUser()

  const [job, setJob] = useState<JobWithHirer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<{
    lat: number
    lng: number
  } | null>(null)

  const [dbRole, setDbRole] = useState<string | null>(null)
  const [existingApp, setExistingApp] = useState<ApplicationRow | null>(null)
  const [applyBusy, setApplyBusy] = useState(false)
  const [applyMessage, setApplyMessage] = useState<string | null>(null)

  const loadWorkerContext = useCallback(async () => {
    if (!jobId || !user?.id || !isSupabaseConfigured()) {
      setDbRole(null)
      setExistingApp(null)
      return
    }

    const { data: uRow, error: uErr } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    console.log("[JobDetail] users role lookup:", { data: uRow, error: uErr })

    if (!uErr && uRow?.role) setDbRole(uRow.role)
    else setDbRole(null)

    const { data: appRow, error: appErr } = await supabase
      .from("applications")
      .select("id, worker_id, job_id, status, created_at")
      .eq("job_id", jobId)
      .eq("worker_id", user.id)
      .maybeSingle()

    console.log("[JobDetail] existing application:", {
      data: appRow,
      error: appErr,
    })

    if (!appErr && appRow) setExistingApp(appRow as ApplicationRow)
    else setExistingApp(null)
  }, [jobId, user?.id])

  useEffect(() => {
    if (!jobId || !isSupabaseConfigured()) {
      setLoading(false)
      setJob(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchJobById(jobId).then(({ data, error: err }) => {
      if (cancelled) return
      if (err) setError(err.message)
      setJob(data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [jobId])

  useEffect(() => {
    if (!userLoaded || !job) return
    void loadWorkerContext()
  }, [userLoaded, job, loadWorkerContext])

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setUserLocation(WORKER_REFERENCE)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setUserLocation(WORKER_REFERENCE)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
    )
  }, [])

  useEffect(() => {
    if (!userLoaded || !user?.id || !jobId || !isSupabaseConfigured()) return

    const channel = supabase
      .channel(`application-${jobId}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          const row = payload.new as { worker_id?: string | null } | null
          if (row?.worker_id !== user.id) return
          void loadWorkerContext()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userLoaded, user?.id, jobId, loadWorkerContext])

  const fixed = job ? isFixedRate(job) : false
  const hirerName = job?.hirer?.name?.trim() || ""
  const urgent = Boolean(job?.is_urgent)
  const verifiedHirer = Boolean(job?.hirer)

  const jobPoint = useMemo(
    () => (job ? parseGeographyPoint(job.location) : null),
    [job],
  )

  const distanceLabel = useMemo(() => {
    if (!jobPoint) return "—"
    const ref = userLocation ?? WORKER_REFERENCE
    const km = distanceKm(ref, jobPoint)
    return `${km.toFixed(1)} KM AWAY`
  }, [jobPoint, userLocation])

  const timeUntil = job ? getTimeUntil(job.start_date, job.shift_start) : "—"

  const subScheduleLine = useMemo(() => {
    if (!job) return ""
    const start = (job.start_date ?? "").trim()
    const shift = formatShift(job.shift_start)
    const addr = job.address?.trim() || "ADDRESS TBC"
    if (!start || shift === "—") return `SCHEDULE TBC · ${addr}`
    const today = new Date().toISOString().slice(0, 10)
    const day = start === today ? "TODAY" : formatStartDate(job.start_date).toUpperCase()
    return `${day}, ${shift.toUpperCase()} · ${addr}`
  }, [job])

  const rateText = useMemo(() => {
    if (!job) return "—"
    if (fixed) {
      const v = job.fixed_rate != null ? Number(job.fixed_rate) : 0
      return `₹${v.toLocaleString("en-IN")} FIXED`
    }
    const hr = job.hourly_rate != null ? Number(job.hourly_rate) : 0
    return `₹${hr.toLocaleString("en-IN")}`
  }, [job, fixed])

  const rateLabel = fixed ? "FIXED" : "PER HOUR"

  const appStatus = existingApp?.status?.toLowerCase() ?? null
  const heroStatusBadge =
    appStatus === "accepted"
      ? "ACCEPTED ✓"
      : appStatus === "pending"
        ? "PENDING"
        : appStatus === "rejected"
          ? "NOT SELECTED"
          : null

  const canApply =
    userLoaded &&
    user &&
    dbRole === "worker" &&
    job?.status === "active" &&
    !existingApp

  async function handleApply() {
    if (!user || !job || !canApply) return
    setApplyBusy(true)
    setApplyMessage(null)

    const row = {
      worker_id: user.id,
      job_id: job.id,
      status: "pending" as const,
    }

    const { data, error: insErr } = await supabase
      .from("applications")
      .insert(row)
      .select()
      .single()

    console.log("[JobDetail] apply insert:", { data, error: insErr, row })

    if (insErr) {
      if (insErr.code === "23505") {
        setApplyMessage("You have already applied to this job.")
        void loadWorkerContext()
      } else {
        setApplyMessage(insErr.message)
      }
      setApplyBusy(false)
      return
    }

    if (data) setExistingApp(data as ApplicationRow)
    setApplyMessage(
      "Application sent. The hirer will see you under applicants for this site.",
    )
    setApplyBusy(false)
  }

  const applyStatusLabel = existingApp
    ? existingApp.status === "pending"
      ? "Application pending"
      : existingApp.status === "accepted"
        ? "Accepted"
        : "Not selected"
    : null

  function openNavigate() {
    if (!job) return
    const pt = parseGeographyPoint(job.location)
    if (pt) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${pt.lat},${pt.lng}`,
        "_blank",
      )
      return
    }
    const addr = job.address?.trim()
    if (addr) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`,
        "_blank",
      )
    }
  }

  return (
    <div className="min-h-screen bg-black pb-[92px]">
      <header className="flex items-center justify-between px-6 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-[10px] font-extrabold uppercase text-white"
          style={{ letterSpacing: "1px" }}
        >
          ← Back
        </button>
        <span
          className="text-[12px] font-black uppercase text-white"
          style={{ letterSpacing: "1px" }}
        >
          Job detail
        </span>
        <span className="w-14" />
      </header>

      {loading ? (
        <p className="px-6 pt-10 text-[10px] font-extrabold uppercase text-[#666]">
          Loading…
        </p>
      ) : null}
      {error ? (
        <p className="px-6 pt-10 text-[13px] font-semibold text-red-400">{error}</p>
      ) : null}
      {!loading && !job ? (
        <p className="px-6 pt-10 text-[10px] font-extrabold uppercase text-[#666]">
          Job not found.
        </p>
      ) : null}

      {job ? (
        <main className="mt-4">
          {/* 1. HERO SECTION */}
          <section className="bg-[#E2FF00] px-6 pb-5 pt-4 text-black">
            <div className="flex items-center gap-2">
              {urgent ? <Badge variant="urgent">Urgent</Badge> : null}
              {heroStatusBadge ? <Badge variant="status">{heroStatusBadge}</Badge> : null}
            </div>

            <h1
              className="mt-3 uppercase"
              style={{
                fontSize: "22px",
                fontWeight: 900,
                lineHeight: 1.1,
              }}
            >
              {job.title}
            </h1>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-[#E2FF00] text-[10px] font-black">
                {initials(hirerName || "Employer")}
              </div>
              <span className="text-[12px] font-extrabold">
                {hirerName || "Employer"}
              </span>
              {verifiedHirer ? <VerifiedCheck /> : null}
            </div>
          </section>

          {/* 2. TIMER STRIP */}
          <section className="bg-black px-6 py-4">
            <div className="flex items-stretch justify-between gap-3">
              <div className="min-w-0">
                <div
                  className="text-[#666]"
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "1px",
                  }}
                >
                  TIME UNTIL START
                </div>
                <div
                  className="mt-1 text-[#E2FF00]"
                  style={{ fontSize: "20px", fontWeight: 900 }}
                >
                  {timeUntil}
                </div>
                <div
                  className="mt-1 truncate text-[#666]"
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.5px",
                  }}
                >
                  {subScheduleLine}
                </div>
              </div>

              <div className="shrink-0 rounded-sm bg-[#E2FF00] px-3 py-2 text-black">
                <div
                  style={{
                    fontSize: "9px",
                    fontWeight: 800,
                    letterSpacing: "1px",
                  }}
                >
                  {rateLabel}
                </div>
                <div style={{ fontSize: "18px", fontWeight: 900 }}>{rateText}</div>
              </div>
            </div>
          </section>

          {/* 3. NAVIGATE BUTTON */}
          <div className="px-6 pt-4">
            <button
              type="button"
              onClick={openNavigate}
              className="flex w-full items-center justify-center gap-2 bg-[#E2FF00] py-4 text-black"
            >
              <NavigateIcon />
              <span
                className="bg-black px-3 py-1 text-white"
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  letterSpacing: "1px",
                }}
              >
                NAVIGATE TO SITE
              </span>
            </button>
          </div>

          {/* 4. STATS ROW */}
          <section className="mt-4 px-6">
            <div className="grid grid-cols-3 overflow-hidden rounded-sm">
              {(
                [
                  {
                    value:
                      job.personnel_count != null ? String(job.personnel_count) : "—",
                    label: "WORKERS",
                  },
                  {
                    value: job.daily_hours != null ? `${job.daily_hours}h` : "—",
                    label: "PER DAY",
                  },
                  {
                    value: cityFromAddress(job.address),
                    label: "LOCATION",
                  },
                ] as const
              ).map((c, idx) => (
                <div
                  key={c.label}
                  className="bg-[#0d0d0d] px-3 py-3 text-center"
                  style={{
                    borderRight: idx < 2 ? "1px solid #1A1A1A" : undefined,
                  }}
                >
                  <div className="text-[#E2FF00] text-[16px] font-black uppercase">
                    {c.value}
                  </div>
                  <div
                    className="mt-1 text-[#666]"
                    style={{
                      fontSize: "10px",
                      fontWeight: 800,
                      letterSpacing: "1px",
                    }}
                  >
                    {c.label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. INFO ROWS */}
          <section className="mt-4 px-6">
            <div className="overflow-hidden rounded-sm bg-[#0a0a0a]">
              {(
                [
                  { label: "FULL ADDRESS", value: job.address?.trim() || "—" },
                  { label: "START DATE", value: formatStartDate(job.start_date) },
                  { label: "SHIFT START", value: formatShift(job.shift_start) },
                  { label: "DISTANCE", value: distanceLabel },
                ] as const
              ).map((r, idx, arr) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                  style={{
                    borderBottom:
                      idx < arr.length - 1 ? "1px solid #1A1A1A" : undefined,
                  }}
                >
                  <span
                    className="text-[#666]"
                    style={{
                      fontSize: "10px",
                      fontWeight: 800,
                      letterSpacing: "1px",
                    }}
                  >
                    {r.label}
                  </span>
                  <span className="text-right text-[13px] font-extrabold text-white">
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 6. OPERATIONAL BRIEFING */}
          <section className="mt-4 px-6">
            <div className="rounded-sm bg-[#0a0a0a] px-4 py-4">
              <div
                className="text-[#666]"
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "1px",
                }}
              >
                OPERATIONAL BRIEFING
              </div>
              <p
                className="mt-2"
                style={{ color: "#666", fontSize: "13px", lineHeight: 1.5 }}
              >
                {job.description?.trim() ? job.description.trim() : "No briefing provided"}
              </p>
            </div>
          </section>

          {dbRole === "hirer" ? (
            <div className="px-6 pt-4">
              <p className="text-center text-[10px] font-extrabold uppercase text-[#666]">
                You’re signed in as a hirer.{" "}
                <Link to="/hirer" className="text-white underline">
                  Open hirer dashboard
                </Link>
              </p>
            </div>
          ) : null}

          {applyMessage ? (
            <div className="px-6 pt-3">
              <p className="text-center text-[12px] font-semibold text-[#666]">
                {applyMessage}
              </p>
            </div>
          ) : null}

          {existingApp && dbRole === "worker" ? (
            <div className="px-6 pt-2">
              <p className="text-center text-[10px] font-extrabold uppercase text-[#666]">
                {applyStatusLabel}
              </p>
            </div>
          ) : null}
        </main>
      ) : null}

      {/* 7. BOTTOM BAR */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-[#E2FF00] bg-black px-6 py-4">
        {!job ? null : dbRole === "worker" ? (
          <>
            {job.status !== "active" ? (
              <button
                type="button"
                disabled
                className="w-full bg-[#1A1A1A] py-4 text-center text-[13px] font-extrabold uppercase text-[#666]"
                style={{ letterSpacing: "1px" }}
              >
                JOB CLOSED
              </button>
            ) : !existingApp ? (
              <button
                type="button"
                disabled={!canApply || applyBusy}
                onClick={() => void handleApply()}
                className="w-full bg-[#E2FF00] py-4 text-center text-[13px] font-extrabold uppercase text-black disabled:opacity-60"
                style={{ letterSpacing: "1px" }}
              >
                {applyBusy ? "REQUESTING…" : "REQUEST JOB"}
              </button>
            ) : existingApp.status === "pending" ? (
              <button
                type="button"
                disabled
                className="w-full bg-black py-4 text-center text-[13px] font-extrabold uppercase text-white"
                style={{ letterSpacing: "1px" }}
              >
                REQUEST SENT — PENDING
              </button>
            ) : existingApp.status === "accepted" ? (
              <button
                type="button"
                disabled
                className="w-full border border-[#E2FF00] bg-[#1A1A1A] py-4 text-center text-[13px] font-extrabold uppercase text-[#E2FF00]"
                style={{ letterSpacing: "1px" }}
              >
                ACCEPTED ✓
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full bg-black py-4 text-center text-[13px] font-extrabold uppercase text-red-400"
                style={{ letterSpacing: "1px" }}
              >
                NOT SELECTED
              </button>
            )}
          </>
        ) : (
          <Link
            to="/worker/feed"
            className="block w-full border border-white/20 py-4 text-center text-[13px] font-extrabold uppercase text-white"
            style={{ letterSpacing: "1px" }}
          >
            Back to feed
          </Link>
        )}
      </div>
    </div>
  )
}
