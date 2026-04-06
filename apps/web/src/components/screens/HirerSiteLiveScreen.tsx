import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"
import { supabase } from "../../lib/supabase"
import type {
  ApplicationWithWorker,
  JobPostingRow,
  WorkerLocationRow,
} from "../../types/job"
import { getDistanceKm, parseGeographyPoint } from "../../lib/geo"
import { fetchWorkerLocations } from "../../lib/workerLocation"

function normalizeWorker(
  w: { name: string | null; phone: string | null; avatar_url: string | null } | { name: string | null; phone: string | null; avatar_url: string | null }[] | null | undefined,
) {
  if (w == null) return null
  if (Array.isArray(w)) return w[0] ?? null
  return w
}

function normalizeApplicationRow(raw: Record<string, unknown>): ApplicationWithWorker {
  const { worker: w, ...rest } = raw
  return {
    ...(rest as unknown as ApplicationWithWorker),
    worker: normalizeWorker(
      w as
        | { name: string | null; phone: string | null; avatar_url: string | null }
        | { name: string | null; phone: string | null; avatar_url: string | null }[]
        | null
        | undefined,
    ),
  }
}

function etaMinutes(distanceKm: number): number {
  // Simple heuristic; tune later or swap to Maps API.
  const SPEED_KMH = 22
  return Math.max(1, Math.round((distanceKm / SPEED_KMH) * 60))
}

export function HirerSiteLiveScreen() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { user } = useUser()

  const [job, setJob] = useState<JobPostingRow | null>(null)
  const [apps, setApps] = useState<ApplicationWithWorker[]>([])
  const [locByWorker, setLocByWorker] = useState<Record<string, WorkerLocationRow>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const sitePoint = useMemo(() => parseGeographyPoint(job?.location), [job?.location])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!jobId || !user?.id) return
      setLoading(true)
      setError(null)

      const jobRes = await supabase
        .from("job_postings")
        .select("*")
        .eq("id", jobId)
        .eq("hirer_id", user.id)
        .maybeSingle()

      if (cancelled) return
      if (jobRes.error) {
        setError(jobRes.error.message)
        setJob(null)
        setApps([])
        setLoading(false)
        return
      }
      setJob((jobRes.data ?? null) as JobPostingRow | null)

      const appsRes = await supabase
        .from("applications")
        .select("*, worker:users!worker_id(name, phone, avatar_url)")
        .eq("job_id", jobId)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })

      if (cancelled) return
      if (appsRes.error) {
        setError(appsRes.error.message)
        setApps([])
        setLoading(false)
        return
      }

      const list = (appsRes.data ?? []).map((r) =>
        normalizeApplicationRow(r as Record<string, unknown>),
      )
      setApps(list)

      const workerIds = list.map((a) => a.worker_id).filter(Boolean) as string[]
      const locRes = await fetchWorkerLocations(workerIds)
      if (!cancelled) {
        const map: Record<string, WorkerLocationRow> = {}
        for (const row of locRes.data) map[row.worker_id] = row
        setLocByWorker(map)
      }

      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [jobId, user?.id])

  useEffect(() => {
    if (!jobId) return

    const chApps = supabase
      .channel(`hirer-site-apps-${jobId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications", filter: `job_id=eq.${jobId}` },
        () => {
          // Reload accepted list quickly
          void supabase
            .from("applications")
            .select("*, worker:users!worker_id(name, phone, avatar_url)")
            .eq("job_id", jobId)
            .eq("status", "accepted")
            .order("created_at", { ascending: false })
            .then(async (res) => {
              if (res.error) return
              const list = (res.data ?? []).map((r) =>
                normalizeApplicationRow(r as Record<string, unknown>),
              )
              setApps(list)
              const workerIds = list.map((a) => a.worker_id).filter(Boolean) as string[]
              const locRes = await fetchWorkerLocations(workerIds)
              const map: Record<string, WorkerLocationRow> = {}
              for (const row of locRes.data) map[row.worker_id] = row
              setLocByWorker(map)
            })
        },
      )
      .subscribe()

    const chLoc = supabase
      .channel(`hirer-site-loc-${jobId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_locations" }, (p) => {
        const row = p.new as WorkerLocationRow | null
        if (!row?.worker_id) return
        setLocByWorker((m) => ({ ...m, [row.worker_id]: row }))
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(chApps)
      void supabase.removeChannel(chLoc)
    }
  }, [jobId])

  const title = job?.title ?? "Site"

  return (
    <div className="flex min-h-screen flex-col bg-ocap-black px-ocap-x pb-8 pt-4 text-ocap-white">
      <header className="flex items-center justify-between border-b border-white/10 pb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-ocap-meta font-extrabold uppercase text-ocap-lime-feed underline"
        >
          Back
        </button>
        <div className="min-w-0 text-center">
          <div className="truncate text-[15px] font-black uppercase text-ocap-white">
            {title}
          </div>
          <div className="text-ocap-meta mt-1 uppercase text-white/60">Live tracking</div>
        </div>
        <Link
          to="/hirer"
          className="text-ocap-meta font-extrabold uppercase text-ocap-lime-feed underline"
        >
          Dashboard
        </Link>
      </header>

      {loading ? (
        <p className="mt-8 text-ocap-meta uppercase text-white/60">Loading…</p>
      ) : null}

      {error ? (
        <div className="mt-6 rounded border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-200">
          {error}
        </div>
      ) : null}

      {!loading && !job ? (
        <p className="mt-8 text-ocap-meta uppercase text-white/60">Site not found.</p>
      ) : null}

      {job && !sitePoint ? (
        <p className="mt-8 text-ocap-meta uppercase text-white/60">
          This site is missing a location point.
        </p>
      ) : null}

      {job && sitePoint && apps.length === 0 ? (
        <p className="mt-8 text-ocap-meta uppercase text-white/60">
          No accepted workers yet.
        </p>
      ) : null}

      {job && sitePoint && apps.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-4">
          {apps.map((app) => {
            const workerId = app.worker_id ?? ""
            const w = app.worker
            const name = w?.name?.trim() || "Worker"
            const loc = workerId ? locByWorker[workerId] : undefined

            const dKm =
              loc != null
                ? getDistanceKm(sitePoint.lat, sitePoint.lng, loc.lat, loc.lng)
                : null
            const est = dKm != null ? etaMinutes(dKm) : null

            return (
              <li key={app.id} className="rounded border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ocap-lime-feed opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-ocap-lime-feed" />
                      </span>
                      <span className="truncate text-[15px] font-extrabold text-ocap-white">
                        {name}
                      </span>
                    </div>
                    <div className="text-ocap-meta mt-2 uppercase text-white/60">
                      {loc
                        ? `DIST ${dKm?.toFixed(1)} KM • EST ${est} MIN`
                        : "WAITING FOR LOCATION…"}
                    </div>
                  </div>
                  {w?.avatar_url ? (
                    <img
                      src={w.avatar_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-sm object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-sm bg-white/10" />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

