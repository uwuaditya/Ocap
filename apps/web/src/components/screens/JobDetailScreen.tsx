import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"
import { fetchJobById } from "../../lib/jobs"
import {
  feedScheduleLine,
  formatKmAway,
  isFixedRate,
  jobDistanceKm,
  rateBadgeText,
} from "../../lib/jobDisplay"
import type { ApplicationRow, JobWithHirer } from "../../types/job"
import { isSupabaseConfigured, supabase } from "../../lib/supabase"

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

function DetailBlock({
  label,
  value,
  urgent,
}: {
  label: string
  value: string
  urgent: boolean
}) {
  return (
    <div
      className={`border-b py-2.5 last:border-b-0 ${
        urgent ? "border-white/10" : "border-black/[0.06]"
      }`}
    >
      <p
        className={`text-ocap-sub uppercase ${
          urgent ? "text-white/55" : "text-ocap-feed-meta"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 text-[14px] font-semibold leading-snug ${
          urgent ? "text-ocap-white" : "text-ocap-black"
        }`}
      >
        {value || "—"}
      </p>
    </div>
  )
}

export function JobDetailScreen() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { user, isLoaded: userLoaded } = useUser()

  const [job, setJob] = useState<JobWithHirer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  const km = job ? jobDistanceKm(job) : null
  const sched = job ? feedScheduleLine(job) : null
  const fixed = job ? isFixedRate(job) : false
  const hirerName = job?.hirer?.name ?? "Employer"
  const urgent = Boolean(job?.is_urgent)

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

  return (
    <div className="flex min-h-screen flex-col bg-ocap-feed-page px-ocap-x pb-ocap-card pt-3">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-[14px] font-extrabold uppercase text-ocap-black underline"
        >
          Back
        </button>
        <span className="text-[18px] font-black uppercase text-ocap-black">
          Job
        </span>
        <span className="w-12" />
      </header>

      {loading && (
        <p className="mt-10 text-ocap-meta uppercase text-ocap-feed-meta">
          Loading…
        </p>
      )}
      {error && <p className="mt-10 text-[13px] text-red-700">{error}</p>}
      {!loading && !job && (
        <p className="mt-10 text-ocap-meta text-ocap-feed-meta">Job not found.</p>
      )}
      {job && (
        <div className="mt-6 flex flex-1 flex-col gap-4">
          <article
            className={`rounded-ocap-feed-card p-ocap-card ${
              urgent
                ? "relative bg-ocap-feed-urgent"
                : "border border-black/[0.06] bg-ocap-feed-card"
            }`}
          >
            {urgent ? (
              <div className="absolute right-ocap-card top-ocap-card bg-ocap-lime-feed px-3 py-1">
                <span className="text-ocap-meta font-extrabold uppercase text-ocap-black">
                  Urgent
                </span>
              </div>
            ) : null}

            <div
              className={`flex items-start justify-between gap-3 ${urgent ? "pr-24" : ""}`}
            >
              <h1
                className={`min-w-0 flex-1 text-ocap-card-title uppercase ${
                  urgent ? "text-ocap-white" : "text-ocap-black"
                }`}
              >
                {job.title}
              </h1>
              {!fixed && (
                <div className="shrink-0 bg-ocap-lime-feed px-2.5 py-1.5 text-ocap-btn text-ocap-black">
                  {rateBadgeText(job)}
                </div>
              )}
            </div>

            <div
              className={`mt-3 flex flex-wrap gap-6 ${
                urgent ? "text-ocap-white" : "text-ocap-feed-meta"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Pin />
                <span className="text-ocap-meta uppercase">
                  {job.address?.trim()
                    ? job.address.trim()
                    : formatKmAway(km)}
                </span>
              </div>
              {sched ? (
                <div className="flex items-center gap-1.5">
                  {sched.icon === "cal" ? <Cal /> : <Clock />}
                  <span className="text-ocap-meta uppercase">{sched.text}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-start gap-3">
              {job.hirer?.avatar_url ? (
                <img
                  src={job.hirer.avatar_url}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-sm object-cover"
                />
              ) : (
                <div
                  className={`h-11 w-11 shrink-0 rounded-sm ${
                    urgent ? "bg-zinc-600" : "bg-zinc-300"
                  }`}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[15px] font-extrabold ${
                      urgent ? "text-ocap-white" : "text-ocap-black"
                    }`}
                  >
                    {hirerName}
                  </span>
                  <Verified />
                </div>
                <p
                  className={`text-ocap-sub mt-0.5 uppercase ${
                    urgent ? "text-ocap-white/80" : "text-ocap-feed-meta"
                  }`}
                >
                  Verified employer • 4.9 rating
                </p>
              </div>
            </div>

            {fixed ? (
              <div
                className={`mt-4 flex flex-col items-end ${
                  urgent ? "" : ""
                }`}
              >
                <span
                  className={`text-ocap-sub uppercase ${
                    urgent ? "text-ocap-white/80" : "text-ocap-feed-meta"
                  }`}
                >
                  Fixed rate
                </span>
                <span className="text-ocap-price-lg text-ocap-lime-feed">
                  {rateBadgeText(job)}
                </span>
              </div>
            ) : null}

            <div className="mt-6">
              <h2
                className={`text-ocap-btn font-black uppercase ${
                  urgent ? "text-ocap-lime-feed" : "text-ocap-black"
                }`}
              >
                Site information
              </h2>
              <div className="mt-2">
                <DetailBlock
                  urgent={urgent}
                  label="Full address"
                  value={job.address?.trim() ?? ""}
                />
                <DetailBlock
                  urgent={urgent}
                  label="Distance (from ref. point)"
                  value={km != null ? `${km} km` : "—"}
                />
                <DetailBlock
                  urgent={urgent}
                  label="Workers needed"
                  value={
                    job.personnel_count != null
                      ? String(job.personnel_count)
                      : ""
                  }
                />
                <DetailBlock
                  urgent={urgent}
                  label="Hours per day"
                  value={
                    job.daily_hours != null ? `${job.daily_hours} hrs` : ""
                  }
                />
                <DetailBlock
                  urgent={urgent}
                  label="Start date"
                  value={formatStartDate(job.start_date)}
                />
                <DetailBlock
                  urgent={urgent}
                  label="Shift start"
                  value={formatShift(job.shift_start)}
                />
                <DetailBlock
                  urgent={urgent}
                  label="Job status"
                  value={job.status?.toUpperCase() ?? "—"}
                />
                <DetailBlock
                  urgent={urgent}
                  label="Operational briefing"
                  value={job.description?.trim() ?? ""}
                />
              </div>
            </div>
          </article>

          {dbRole === "hirer" ? (
            <p className="text-center text-ocap-meta uppercase text-ocap-feed-meta">
              You’re signed in as a hirer.{" "}
              <Link to="/hirer" className="font-bold underline text-ocap-black">
                Open hirer dashboard
              </Link>
            </p>
          ) : null}

          {applyMessage ? (
            <p
              className={`text-center text-[13px] font-semibold ${
                applyMessage.startsWith("Application sent")
                  ? "text-green-700"
                  : "text-red-700"
              }`}
            >
              {applyMessage}
            </p>
          ) : null}

          {existingApp && dbRole === "worker" ? (
            <p className="text-center text-ocap-meta font-bold uppercase text-ocap-black">
              {applyStatusLabel}
            </p>
          ) : null}

          {job.status !== "active" && dbRole === "worker" ? (
            <p className="text-center text-ocap-meta uppercase text-ocap-feed-meta">
              This job is {job.status} and is not accepting new applications.
            </p>
          ) : null}

          {canApply ? (
            <button
              type="button"
              disabled={applyBusy}
              onClick={() => void handleApply()}
              className="w-full bg-ocap-lime-feed py-3.5 text-ocap-btn uppercase text-ocap-black disabled:opacity-60"
            >
              {applyBusy ? "Applying…" : "Apply for this job"}
            </button>
          ) : null}

          <Link
            to="/worker/feed"
            className="w-full border-2 border-ocap-black py-3.5 text-center text-ocap-btn uppercase text-ocap-black"
          >
            Back to feed
          </Link>
        </div>
      )}
    </div>
  )
}
