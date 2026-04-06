/**
 * Loads all active jobs for the worker app. Map and Feed apply geolocation
 * (50 km filter, distance labels, NEARBY sort) locally — not here.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { fetchActiveJobs } from "../lib/jobs"
import type { JobWithHirer } from "../types/job"
import { isSupabaseConfigured, supabase } from "../lib/supabase"

type WorkerJobsState = {
  jobs: JobWithHirer[]
  loading: boolean
  error: Error | null
  missingConfig: boolean
  reload: () => void
}

const WorkerJobsContext = createContext<WorkerJobsState | null>(null)

export function WorkerJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<JobWithHirer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const missingConfig = !isSupabaseConfigured()

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setJobs([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await fetchActiveJobs()
    if (err) setError(err)
    setJobs(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const channel = supabase
      .channel("worker-jobs-job_postings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_postings" },
        () => {
          void load()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load])

  const value = useMemo(
    () => ({
      jobs,
      loading,
      error,
      missingConfig,
      reload: load,
    }),
    [jobs, loading, error, missingConfig, load],
  )

  return (
    <WorkerJobsContext.Provider value={value}>
      {children}
    </WorkerJobsContext.Provider>
  )
}

export function useWorkerJobs(): WorkerJobsState {
  const ctx = useContext(WorkerJobsContext)
  if (!ctx) {
    throw new Error("useWorkerJobs must be used within WorkerJobsProvider")
  }
  return ctx
}
