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

  async function closeSite(jobId: string) {
    if (!user?.id) return
    const res = await supabase
      .from("job_postings")
      .update({ status: "closed" })
      .eq("id", jobId)
      .eq("hirer_id", user.id)
      .select()

    console.log("[HirerDashboard] close site response:", res)

    if (!res.error) {
      void loadDashboard(user.id)
      setExpandedJobId(null)
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

  function rateLine(job: JobRow): string {
    if (job.is_fixed_rate && job.fixed_rate != null) {
      return `₹${Number(job.fixed_rate).toLocaleString("en-IN")} FIXED`
    }
    if (job.hourly_rate != null) {
      return `₹${Number(job.hourly_rate).toLocaleString("en-IN")}/HR`
    }
    return "—"
  }

  const email = user?.primaryEmailAddress?.emailAddress ?? ""

  return (
    <MobileShell className="bg-ocap-black">
      <div className="flex min-h-screen flex-col bg-ocap-black text-ocap-white">
        <header className="flex items-center justify-between border-b-2 border-ocap-lime-feed px-ocap-x py-4">
          <span className="text-[18px] font-black uppercase tracking-tight text-ocap-lime-feed">
            OCAP
          </span>
          <div className="flex min-w-0 flex-1 flex-col items-end gap-2 pl-4 sm:flex-row sm:items-center sm:justify-end">
            <span className="max-w-[200px] truncate text-ocap-meta text-white/70 sm:max-w-none">
              {email}
            </span>
            <Link
              to="/hirer/profile"
              className="shrink-0 border border-ocap-lime-feed bg-transparent px-3 py-2 text-center text-ocap-nav font-extrabold uppercase text-ocap-lime-feed"
            >
              Profile
            </Link>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/login" })}
              className="shrink-0 border border-ocap-lime-feed bg-transparent px-3 py-2 text-ocap-nav font-extrabold uppercase text-ocap-lime-feed"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 px-ocap-x py-6 sm:grid-cols-3">
          {(
            [
              { label: "ACTIVE SITES", value: stats.activeSites },
              { label: "TOTAL APPLICANTS", value: stats.totalApplicants },
              { label: "FILLED SITES", value: stats.filledSites },
            ] as const
          ).map((s) => (
            <div
              key={s.label}
              className="rounded-ocap-post bg-ocap-feed-urgent px-ocap-card py-4 text-center"
            >
              <div className="text-ocap-price-lg text-ocap-lime-feed">{s.value}</div>
              <div className="text-ocap-meta mt-1 font-extrabold uppercase text-white/80">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className="px-ocap-x pb-8">
          <h2 className="text-ocap-card-title font-black uppercase text-ocap-white">
            <span className="border-b-2 border-ocap-lime-feed pb-1">MY JOB SITES</span>
          </h2>

          <Link
            to="/hirer/post"
            className="mt-6 block w-full bg-ocap-lime-feed py-4 text-center text-ocap-btn uppercase text-ocap-black shadow-ocap-post-btn"
          >
            POST NEW JOB SITE
          </Link>

          {loadError && (
            <p className="mt-4 text-[13px] font-semibold text-red-400">{loadError}</p>
          )}

          {loading ? (
            <div className="mt-10 flex justify-center">
              <svg
                className="h-8 w-8 animate-spin text-ocap-lime-feed"
                viewBox="0 0 24 24"
                fill="none"
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
            </div>
          ) : jobs.length === 0 ? (
            <div className="mt-12 text-center">
              <p className="text-ocap-card-title font-bold uppercase text-ocap-post-label">
                No job sites posted yet
              </p>
              <p className="text-ocap-meta mt-2 text-ocap-post-label">
                Post your first job site to find workers
              </p>
            </div>
          ) : (
            <ul className="mt-8 flex flex-col gap-6">
              {jobs.map((job) => {
                const applicants = applicantCountByJob[job.id] ?? 0
                const expanded = expandedJobId === job.id
                const list = applicantsByJob[job.id]
                const loadingList = loadingApplicants[job.id]

                const statusUpper = job.status.toUpperCase()
                const badgeClass =
                  job.status === "active"
                    ? "bg-ocap-lime-feed text-ocap-black"
                    : job.status === "filled"
                      ? "bg-zinc-500 text-ocap-white"
                      : "bg-red-600 text-ocap-white"

                return (
                  <li
                    key={job.id}
                    className="rounded-ocap-post border border-white/10 bg-ocap-feed-urgent p-ocap-card"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="max-w-[220px] text-[18px] font-black uppercase leading-tight text-ocap-white">
                        {job.title}
                      </h3>
                      <span
                        className={`shrink-0 px-2 py-1 text-ocap-meta font-extrabold uppercase ${badgeClass}`}
                      >
                        {statusUpper}
                      </span>
                    </div>

                    <p className="text-ocap-meta mt-3 text-white/70">
                      {job.personnel_count ?? "—"} workers • {job.daily_hours ?? "—"}{" "}
                      hrs/day • {job.start_date ?? "—"}
                    </p>
                    <p className="text-ocap-btn mt-2 font-black text-ocap-lime-feed">
                      {rateLine(job)}
                    </p>
                    {job.is_urgent ? (
                      <div className="mt-2 inline-block bg-ocap-lime-feed px-2 py-0.5">
                        <span className="text-[10px] font-extrabold uppercase text-ocap-black">
                          URGENT
                        </span>
                      </div>
                    ) : null}
                    <p className="text-ocap-sub mt-2 uppercase text-ocap-post-label">
                      {applicants} applicants
                    </p>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => toggleApplicants(job.id)}
                        className="flex-1 border-2 border-ocap-lime-feed bg-ocap-black py-3 text-ocap-btn uppercase text-ocap-lime-feed"
                      >
                        {expanded ? "HIDE APPLICANTS" : "VIEW APPLICANTS"}
                      </button>
                      <button
                        type="button"
                        disabled={job.status === "closed"}
                        onClick={() => void closeSite(job.id)}
                        className="flex-1 bg-zinc-600 py-3 text-ocap-btn uppercase text-ocap-white disabled:opacity-40"
                      >
                        CLOSE SITE
                      </button>
                    </div>

                    {expanded ? (
                      <div className="mt-6 border-t border-white/10 pt-4">
                        {loadingList ? (
                          <p className="text-ocap-meta text-ocap-post-label">
                            Loading applicants…
                          </p>
                        ) : !list || list.length === 0 ? (
                          <p className="text-ocap-meta text-ocap-post-label">
                            No applicants yet
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-4">
                            {list.map((app) => {
                              const w = normalizeWorker(app.worker)
                              const name = w?.name?.trim() || "Anonymous Worker"
                              const phone = w?.phone ?? "—"
                              const st = app.status.toLowerCase()
                              const stClass =
                                st === "pending"
                                  ? "bg-yellow-500 text-ocap-black"
                                  : st === "accepted"
                                    ? "bg-ocap-lime-feed text-ocap-black"
                                    : "bg-red-600 text-ocap-white"

                              return (
                                <li
                                  key={app.id}
                                  className="rounded border border-white/10 bg-black/30 p-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[15px] font-extrabold text-ocap-white">
                                      {name}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 text-[10px] font-extrabold uppercase ${stClass}`}
                                    >
                                      {app.status.toUpperCase()}
                                    </span>
                                  </div>
                                  <p className="text-ocap-meta mt-1 text-white/70">{phone}</p>
                                  <p className="text-ocap-sub mt-1 uppercase text-ocap-post-label">
                                    Applied {daysAgoLabel(app.created_at)}
                                  </p>
                                  <div className="mt-3 flex gap-2">
                                    <button
                                      type="button"
                                      disabled={app.status !== "pending"}
                                      onClick={() =>
                                        void setApplicationStatus(
                                          app.id,
                                          job.id,
                                          "accepted",
                                        )
                                      }
                                      className="flex-1 bg-ocap-lime-post py-3 text-ocap-nav font-extrabold uppercase text-ocap-black disabled:opacity-40"
                                    >
                                      ACCEPT
                                    </button>
                                    <button
                                      type="button"
                                      disabled={app.status !== "pending"}
                                      onClick={() =>
                                        void setApplicationStatus(
                                          app.id,
                                          job.id,
                                          "rejected",
                                        )
                                      }
                                      className="flex-1 bg-ocap-feed-urgent py-3 text-ocap-nav font-extrabold uppercase text-red-400 disabled:opacity-40"
                                    >
                                      REJECT
                                    </button>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}

          <Link
            to="/worker/feed"
            className="text-ocap-meta mt-10 block text-center uppercase text-ocap-post-label underline"
          >
            Switch to worker app
          </Link>
        </div>
      </div>
    </MobileShell>
  )
}
