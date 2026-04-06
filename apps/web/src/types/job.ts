export type JobPostingRow = {
  id: string
  hirer_id: string | null
  title: string
  description: string | null
  location: unknown
  address: string | null
  hourly_rate: number | null
  is_fixed_rate: boolean | null
  fixed_rate: number | null
  personnel_count: number | null
  daily_hours: number | null
  start_date: string | null
  shift_start: string | null
  is_urgent: boolean | null
  status: string
  created_at: string
}

export type HirerPreview = {
  name: string | null
  avatar_url: string | null
}

export type JobWithHirer = JobPostingRow & {
  hirer: HirerPreview | null
}

export type WorkerPreview = {
  name: string | null
  phone: string | null
  avatar_url: string | null
}

export type ApplicationRow = {
  id: string
  worker_id: string | null
  job_id: string
  status: string
  created_at: string
}

export type ApplicationWithWorker = ApplicationRow & {
  /** Normalized to a single row; Supabase may return an object or one-element array. */
  worker: WorkerPreview | null
}
