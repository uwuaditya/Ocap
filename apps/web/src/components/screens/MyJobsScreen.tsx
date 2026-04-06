import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"
import { fetchWorkerApplications } from "../../lib/jobs"
import type { ApplicationWithJob } from "../../types/job"
import { isSupabaseConfigured, supabase } from "../../lib/supabase"

function statusBadge(status: string): { label: string; className: string } {
  const s = status.toLowerCase()
  if (s === "accepted") {
    return { label: "ACCEPTED", className: "bg-ocap-lime-feed text-ocap-black" }
  }
  if (s === "rejected") {
    return { label: "REJECTED", className: "bg-red-600 text-ocap-white" }
  }
  return { label: "PENDING", className: "bg-yellow-500 text-ocap-black" }
}

export function MyJobsScreen() {
  const { user, isLoaded } = useUser()

  const [apps, setApps] = useState<ApplicationWithJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const missingConfig = !isSupabaseConfigured()

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!isLoaded) return

      if (missingConfig || !user?.id) {
        setApps([])
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const { data, error: err } = await fetchWorkerApplications(user.id)
      if (cancelled) return

      if (err) {
        setError(err.message)
        setApps([])
      } else {
        setApps(data ?? [])
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isLoaded, user?.id, missingConfig])

  useEffect(() => {
    if (!isLoaded || !user?.id || missingConfig) return

    const channel = supabase
      .channel(`worker-applications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
          filter: `worker_id=eq.${user.id}`,
        },
        () => {
          void fetchWorkerApplications(user.id).then(({ data, error: err }) => {
            if (err) {
              setError(err.message)
              return
            }
            setError(null)
            setApps(data ?? [])
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isLoaded, user?.id, missingConfig])

  const active = useMemo(
    () => apps.filter((a) => a.status !== "rejected"),
    [apps],
  )

  return (
    <div className="flex min-h-screen flex-col bg-ocap-feed-page px-ocap-x pb-6 pt-6">
      <header className="flex items-center justify-between">
        <h1 className="text-ocap-title font-black uppercase text-ocap-black">
          My jobs
        </h1>
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-sm object-cover"
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-sm bg-zinc-200" />
        )}
      </header>

      {missingConfig && (
        <p className="text-ocap-meta mt-4 text-ocap-feed-meta">
          Set <code className="text-ocap-black">VITE_SUPABASE_URL</code> and{" "}
          <code className="text-ocap-black">VITE_SUPABASE_ANON_KEY</code> in{" "}
          <code className="text-ocap-black">apps/web/.env</code> to load your
          applications.
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-ocap-feed-card border border-red-200 bg-red-50 p-ocap-card text-[13px] text-red-800">
          {error}
        </div>
      )}

      {loading && !missingConfig ? (
        <p className="text-ocap-meta mt-6 uppercase text-ocap-feed-meta">
          Loading…
        </p>
      ) : null}

      {!loading && !missingConfig && active.length === 0 ? (
        <p className="text-ocap-meta mt-6 uppercase text-ocap-feed-meta">
          No active applications yet.
        </p>
      ) : null}

      {!loading && !missingConfig && active.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-4">
          {active.map((app) => {
            const job = app.job
            const title = job?.title ?? "Job"
            const hirerName = job?.hirer?.name ?? "Employer"
            const badge = statusBadge(app.status)
            return (
              <li
                key={app.id}
                className="rounded-ocap-feed-card border border-black/[0.06] bg-ocap-feed-card p-ocap-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ocap-card-title uppercase text-ocap-black">
                      {title}
                    </p>
                    <p className="text-ocap-sub mt-1 uppercase text-ocap-feed-meta">
                      {hirerName}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1.5 text-ocap-btn uppercase ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {job?.id ? (
                  <Link
                    to={`/worker/job/${job.id}`}
                    className="mt-4 flex w-full items-center justify-center border-2 border-ocap-black py-3.5 text-ocap-btn uppercase text-ocap-black"
                  >
                    View job
                  </Link>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
