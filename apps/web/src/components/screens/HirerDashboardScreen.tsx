// NOTE: Run these in Supabase SQL Editor if queries return empty:
// ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "hirers read own jobs" ON job_postings
//   FOR SELECT USING (hirer_id = auth.uid()::text);
// CREATE POLICY "hirers read own applications" ON applications
//   FOR SELECT USING (
//     job_id IN (
//       SELECT id FROM job_postings WHERE hirer_id = auth.uid()::text
//     )
//   );
//
// For now use the anon key which bypasses RLS in development.
// The queries will work with anon key as long as RLS is not enabled on these tables yet.

import { Link } from "react-router-dom"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useClerk, useUser } from "@clerk/clerk-react"
import { MobileShell } from "../MobileShell"
import { supabase } from "../../lib/supabase"
import type { ApplicationWithWorker, JobPostingRow, WorkerPreview } from "../../types/job"

function normalizeWorker(
  w: WorkerPreview | WorkerPreview[] | null | undefined,
): WorkerPreview | null {
  if (w == null) return null
  if (Array.isArray(w)) return w[0] ?? null
  return w
}

function normalizeApplicationRow(raw: Record<string, unknown>): ApplicationWithWorker {
  const { worker: w, ...rest } = raw
  return {
    ...(rest as unknown as ApplicationWithWorker),
    worker: normalizeWorker(w as WorkerPreview | WorkerPreview[] | null),
  }
}

function daysAgoLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d <= 0) return "today"
  if (d === 1) return "1 day ago"
  return `${d} days ago`
}

function formatStartDate(d: string | null): string {
  if (!d) return "—"
  try {
    const x = new Date(`${d}T12:00:00`)
    return x.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return d
  }
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const a = parts[0]?.[0] ?? ""
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  return (a + b).toUpperCase() || "—"
}

function statusBadge(job: JobRow): { label: string; className: string } {
  if (job.status === "active") {
    return { label: "ACTIVE", className: "bg-[#E2FF00] text-black" }
  }
  if (job.status === "filled") {
    return { label: "FILLED", className: "bg-[#333] text-white" }
  }
  return {
    label: "CLOSED",
    className: "bg-[#1A1A1A] text-[#ff4444] border border-[#ff4444]",
  }
}

function ratePill(job: JobRow): string {
  if (job.is_fixed_rate && job.fixed_rate != null) {
    return `₹${Number(job.fixed_rate).toLocaleString("en-IN")} FIXED`
  }
  if (job.hourly_rate != null) {
    return `₹${Number(job.hourly_rate).toLocaleString("en-IN")}/HR`
  }
  return "—"
}

type JobRow = JobPostingRow

export function HirerDashboardScreen() {
  const { signOut } = useClerk()
  const { user } = useUser()

  const [jobs, setJobs] = useState<JobRow[]>([])
  const [applicantCountByJob, setApplicantCountByJob] = useState<Record<string, number>>(
    {},
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [applicantsByJob, setApplicantsByJob] = useState<
    Record<string, ApplicationWithWorker[]>
  >({})
  const [loadingApplicants, setLoadingApplicants] = useState<Record<string, boolean>>(
    {},
  )

  const loadDashboard = useCallback(async (hirerId: string) => {
    setLoading(true)
    setLoadError(null)

    const jobsRes = await supabase
      .from("job_postings")
      .select("*")
      .eq("hirer_id", hirerId)
      .order("created_at", { ascending: false })

    console.log("[HirerDashboard] job_postings response:", jobsRes)

    if (jobsRes.error) {
      setLoadError(jobsRes.error.message)
      setJobs([])
      setApplicantCountByJob({})
      setLoading(false)
      return
    }

    const rows = (jobsRes.data ?? []) as JobRow[]
    setJobs(rows)

    const jobIds = rows.map((j) => j.id)
    if (jobIds.length === 0) {
      setApplicantCountByJob({})
      setLoading(false)
      return
    }

    const appsRes = await supabase
      .from("applications")
      .select("id, job_id")
      .in("job_id", jobIds)

    console.log("[HirerDashboard] applications count response:", appsRes)

    const counts: Record<string, number> = {}
    for (const id of jobIds) counts[id] = 0
    if (!appsRes.error && appsRes.data) {
      for (const row of appsRes.data as { job_id: string }[]) {
        counts[row.job_id] = (counts[row.job_id] ?? 0) + 1
      }
    }
    setApplicantCountByJob(counts)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    void loadDashboard(user.id)
  }, [user?.id, loadDashboard])

  const stats = useMemo(() => {
    const activeSites = jobs.filter((j) => j.status === "active").length
    const filledSites = jobs.filter((j) => j.status === "filled").length
    const totalApplicants = Object.values(applicantCountByJob).reduce((a, b) => a + b, 0)
    return { activeSites, filledSites, totalApplicants }
  }, [jobs, applicantCountByJob])

  async function updateJobStatus(jobId: string, status: "active" | "closed") {
    if (!user?.id) return
    const res = await supabase
      .from("job_postings")
      .update({ status })
      .eq("id", jobId)
      .eq("hirer_id", user.id)
      .select()

    console.log("[HirerDashboard] job_postings status update:", {
      jobId,
      status,
      data: res.data,
      error: res.error,
    })

    if (!res.error) {
      void loadDashboard(user.id)
      setExpandedJobId((prev) => (prev === jobId ? null : prev))
    }
  }

  async function fetchApplicantsForJob(jobId: string) {
    setLoadingApplicants((m) => ({ ...m, [jobId]: true }))
    const res = await supabase
      .from("applications")
      .select("*, worker:users!worker_id(name, phone, avatar_url)")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })

    console.log("[HirerDashboard] applications list response:", {
      jobId,
      data: res.data,
      error: res.error,
    })

    if (res.error) {
      setLoadingApplicants((m) => ({ ...m, [jobId]: false }))
      return
    }

    const list = (res.data ?? []).map((row) =>
      normalizeApplicationRow(row as Record<string, unknown>),
    )
    setApplicantsByJob((m) => ({ ...m, [jobId]: list }))
    setLoadingApplicants((m) => ({ ...m, [jobId]: false }))
  }

  function toggleApplicants(jobId: string) {
    if (expandedJobId === jobId) {
      setExpandedJobId(null)
      return
    }
    setExpandedJobId(jobId)
    if (!applicantsByJob[jobId]) {
      void fetchApplicantsForJob(jobId)
    }
  }

  async function setApplicationStatus(
    appId: string,
    jobId: string,
    status: "accepted" | "rejected",
  ) {
    const res = await supabase
      .from("applications")
      .update({ status })
      .eq("id", appId)
      .select()

    console.log("[HirerDashboard] application update response:", res)

    if (!res.error) {
      void fetchApplicantsForJob(jobId)
    }
  }

  const email = user?.primaryEmailAddress?.emailAddress ?? ""

  return (
    <MobileShell className="bg-black">
      <div className="flex min-h-screen flex-col bg-black text-white">
        {/* TOPBAR */}
        <header className="flex items-center justify-between px-6 py-4">
          <span
            className="text-[#E2FF00]"
            style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "2px" }}
          >
            OCAP
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <span className="max-w-[170px] truncate text-[11px] text-[#444]">
              {email}
            </span>
            <Link
              to="/hirer/profile"
              className="shrink-0 rounded border border-[#1A1A1A] px-3 py-2 text-[10px] font-extrabold uppercase text-white"
              style={{ letterSpacing: "1px" }}
            >
              Profile
            </Link>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/login" })}
              className="shrink-0 rounded border border-[#E2FF00] px-3 py-2 text-[10px] font-extrabold uppercase text-[#E2FF00]"
              style={{ letterSpacing: "1px" }}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* STATS ROW */}
        <section className="px-6">
          <div className="grid grid-cols-3 overflow-hidden rounded bg-[#0a0a0a]">
            {(
              [
                { label: "ACTIVE SITES", value: stats.activeSites },
                { label: "TOTAL APPLICANTS", value: stats.totalApplicants },
                { label: "SITES FILLED", value: stats.filledSites },
              ] as const
            ).map((s, idx) => (
              <div
                key={s.label}
                className="px-3 py-4 text-center"
                style={{ borderRight: idx < 2 ? "1px solid #1A1A1A" : undefined }}
              >
                <div className="text-[#E2FF00]" style={{ fontSize: "28px", fontWeight: 900 }}>
                  {s.value}
                </div>
                <div
                  className="mt-1 text-[#444]"
                  style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "1px" }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION HEADER */}
        <section className="mt-6 flex items-center justify-between px-6">
          <h2
            className="text-white"
            style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "2px" }}
          >
            <span className="inline-block border-b-2 border-[#E2FF00] pb-1">
              MY JOB SITES
            </span>
          </h2>
          <Link
            to="/hirer/post"
            className="rounded bg-[#E2FF00] px-3 py-2 text-[11px] font-extrabold uppercase text-black"
            style={{ letterSpacing: "1px" }}
          >
            + Post new job site
          </Link>
        </section>

        <section className="px-6 pb-10 pt-4">
          {loadError ? (
            <p className="mt-2 text-[13px] font-semibold text-[#ff4444]">{loadError}</p>
          ) : null}

          {loading ? (
            <div className="mt-10 flex justify-center">
              <svg className="h-8 w-8 animate-spin text-[#E2FF00]" viewBox="0 0 24 24" fill="none">
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
            </div>
          ) : jobs.length === 0 ? (
            <div className="mx-auto mt-10 max-w-[420px] text-center" style={{ padding: "40px 0" }}>
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                className="mx-auto"
                aria-hidden
              >
                <path
                  d="M6 9V7a6 6 0 0 1 12 0v2"
                  stroke="#E2FF00"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M4 9h16l-1 12H5L4 9z"
                  stroke="#E2FF00"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-4 text-[16px] font-extrabold text-white">
                No job sites posted yet
              </p>
              <p className="mt-2 text-[13px] text-[#444]">
                Post your first job to find workers
              </p>
              <Link
                to="/hirer/post"
                className="mt-6 block w-full rounded bg-[#E2FF00] py-4 text-[11px] font-extrabold uppercase text-black"
                style={{ letterSpacing: "1px" }}
              >
                Post your first job
              </Link>
            </div>
          ) : (
            <ul className="mt-2 flex flex-col gap-[10px]">
              {jobs.map((job) => {
                const applicants = applicantCountByJob[job.id] ?? 0
                const expanded = expandedJobId === job.id
                const list = applicantsByJob[job.id]
                const loadingList = loadingApplicants[job.id]
                const acceptedCount =
                  list?.filter((a) => a.status?.toLowerCase() === "accepted").length ?? 0
                const hasAccepted = acceptedCount > 0
                const acceptedWorkers =
                  (list ?? []).filter((a) => a.status?.toLowerCase() === "accepted") ?? []

                const st = statusBadge(job)
                const faded = job.status === "closed"
                const urgentBadge = Boolean(job.is_urgent)

                return (
                  <li
                    key={job.id}
                    className="rounded-[6px] border border-[#1A1A1A] bg-[#0d0d0d]"
                    style={{ opacity: faded ? 0.6 : 1 }}
                  >
                    {/* TOP SECTION */}
                    <div className="p-[14px]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-[15px] font-black text-white">
                            {job.title}
                          </h3>
                          <div className="mt-1 text-[10px] text-[#555]">
                            {job.personnel_count ?? "—"} workers · {job.daily_hours ?? "—"}{" "}
                            hrs/day · {formatStartDate(job.start_date)}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded px-2 py-1 text-[10px] font-extrabold uppercase ${st.className}`}
                              style={{ letterSpacing: "1px" }}
                            >
                              {st.label}
                            </span>
                            {urgentBadge ? (
                              <span
                                className="inline-flex items-center rounded border border-[#E2FF00] bg-black px-2 py-1 text-[10px] font-extrabold uppercase text-[#E2FF00]"
                                style={{ letterSpacing: "1px" }}
                              >
                                URGENT
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div
                          className={`shrink-0 rounded px-2.5 py-2 text-[11px] font-black ${
                            faded ? "bg-[#1A1A1A] text-[#444]" : "bg-[#E2FF00] text-black"
                          }`}
                        >
                          {ratePill(job)}
                        </div>
                      </div>
                    </div>

                    {/* APPLICANTS BAR */}
                    <button
                      type="button"
                      onClick={() => toggleApplicants(job.id)}
                      className="flex w-full items-center justify-between bg-[#111] px-[14px] py-2"
                    >
                      <div className="text-left text-[10px] font-extrabold uppercase text-[#444]">
                        <span style={{ letterSpacing: "1px" }}>
                          <span className="text-[#E2FF00]">{applicants}</span>{" "}
                          applicants
                        </span>
                        {hasAccepted ? (
                          <span className="text-[#E2FF00]" style={{ letterSpacing: "1px" }}>
                            {" "}
                            · {acceptedCount} accepted
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="text-[10px] font-extrabold uppercase text-[#444]"
                        style={{ letterSpacing: "1px" }}
                      >
                        {expanded ? "▲ COLLAPSE" : "TAP TO EXPAND ↓"}
                      </div>
                    </button>

                    {/* APPLICANTS PANEL */}
                    {expanded ? (
                      <div className="bg-[#080808] px-[14px] py-3">
                        {loadingList ? (
                          <p className="text-[10px] font-extrabold uppercase text-[#444]">
                            Loading applicants…
                          </p>
                        ) : !list || list.length === 0 ? (
                          <p className="text-[10px] font-extrabold uppercase text-[#444]">
                            No applicants yet
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-3">
                            {list.map((app) => {
                              const w = normalizeWorker(app.worker)
                              const name = w?.name?.trim() || "Anonymous Worker"
                              const phone = w?.phone ?? "—"
                              const st = app.status?.toLowerCase() ?? "pending"
                              const badge =
                                st === "accepted"
                                  ? "bg-[#E2FF00] text-black"
                                  : st === "rejected"
                                    ? "bg-[#1A1A1A] text-[#ff4444] border border-[#ff4444]"
                                    : "border border-[#E2FF00] text-[#E2FF00]"

                              return (
                                <li
                                  key={app.id}
                                  className="rounded border border-[#1A1A1A] bg-black/40 p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-start gap-3">
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1A1A1A] text-[11px] font-black text-[#E2FF00]">
                                        {initials(name)}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="truncate text-[12px] font-extrabold text-white">
                                          {name}
                                        </div>
                                        <div className="mt-1 text-[10px] text-[#444]">
                                          {phone} · Applied {daysAgoLabel(app.created_at)}
                                        </div>
                                      </div>
                                    </div>

                                    {st === "pending" ? (
                                      <div className="flex shrink-0 gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void setApplicationStatus(app.id, job.id, "accepted")
                                          }
                                          className="rounded bg-[#E2FF00] px-3 py-2 text-[9px] font-extrabold uppercase text-black"
                                          style={{ letterSpacing: "1px" }}
                                        >
                                          ACCEPT
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void setApplicationStatus(app.id, job.id, "rejected")
                                          }
                                          className="rounded border border-[#ff4444] bg-[#1A1A1A] px-3 py-2 text-[9px] font-extrabold uppercase text-[#ff4444]"
                                          style={{ letterSpacing: "1px" }}
                                        >
                                          REJECT
                                        </button>
                                      </div>
                                    ) : (
                                      <span
                                        className={`shrink-0 rounded px-2 py-1 text-[10px] font-extrabold uppercase ${badge}`}
                                        style={{ letterSpacing: "1px" }}
                                      >
                                        {st.toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        )}

                        {/* LIVE TRACKING PANEL (placeholder) */}
                        {hasAccepted ? (
                          <div className="mt-4 rounded border border-[#1A1A1A] bg-[#0a0a0a] p-3">
                            <div
                              className="text-[10px] font-extrabold uppercase text-[#444]"
                              style={{ letterSpacing: "1px" }}
                            >
                              LIVE WORKER STATUS
                            </div>
                            <ul className="mt-2 flex flex-col gap-2">
                              {acceptedWorkers.slice(0, 3).map((a) => {
                                const w = normalizeWorker(a.worker)
                                const name = w?.name?.trim() || "Worker"
                                return (
                                  <li key={a.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E2FF00] opacity-60" />
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E2FF00]" />
                                      </span>
                                      <span className="text-[12px] font-extrabold text-white">
                                        {name}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-extrabold uppercase text-[#E2FF00]">
                                      ON SITE
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* CARD ACTIONS */}
                    <div className="grid grid-cols-2 gap-px bg-[#1A1A1A]">
                      {job.status === "active" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleApplicants(job.id)}
                            className="bg-black py-3 text-[11px] font-extrabold uppercase text-[#E2FF00]"
                            style={{ letterSpacing: "1px" }}
                          >
                            VIEW APPLICANTS
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const ok = window.confirm("Close this site?")
                              if (!ok) return
                              void updateJobStatus(job.id, "closed")
                            }}
                            className="bg-black py-3 text-[11px] font-extrabold uppercase text-[#ff4444]"
                            style={{ letterSpacing: "1px" }}
                          >
                            CLOSE SITE
                          </button>
                        </>
                      ) : job.status === "closed" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void updateJobStatus(job.id, "active")}
                            className="bg-black py-3 text-[11px] font-extrabold uppercase text-[#444]"
                            style={{ letterSpacing: "1px" }}
                          >
                            REOPEN SITE
                          </button>
                          <button
                            type="button"
                            disabled
                            className="bg-black py-3 text-[11px] font-extrabold uppercase text-[#333] opacity-60"
                            style={{ letterSpacing: "1px" }}
                          >
                            ARCHIVED
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleApplicants(job.id)}
                            className="bg-black py-3 text-[11px] font-extrabold uppercase text-[#E2FF00]"
                            style={{ letterSpacing: "1px" }}
                          >
                            VIEW APPLICANTS
                          </button>
                          <button
                            type="button"
                            disabled
                            className="bg-black py-3 text-[11px] font-extrabold uppercase text-[#333] opacity-60"
                            style={{ letterSpacing: "1px" }}
                          >
                            FILLED
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <Link
            to="/worker/feed"
            className="mt-10 block text-center text-[10px] font-extrabold uppercase text-[#444] underline"
            style={{ letterSpacing: "1px" }}
          >
            Switch to worker app
          </Link>
        </section>
      </div>
    </MobileShell>
  )
}
