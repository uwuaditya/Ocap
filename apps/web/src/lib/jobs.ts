import { supabase } from "./supabase"
import type { HirerPreview, JobWithHirer } from "../types/job"

function normalizeHirer(
  hirer: HirerPreview | HirerPreview[] | null | undefined,
): HirerPreview | null {
  if (hirer == null) return null
  if (Array.isArray(hirer)) return hirer[0] ?? null
  return hirer
}

function normalizeJobRow(raw: Record<string, unknown>): JobWithHirer {
  const { hirer: h, ...rest } = raw
  return {
    ...(rest as unknown as JobWithHirer),
    hirer: normalizeHirer(h as HirerPreview | HirerPreview[] | null),
  }
}

/**
 * Active gigs ordered newest first.
 * Matches: select * from job_postings where status = 'active' order by created_at desc
 * plus an embedded hirer row for employer name (PostgREST resource embedding).
 */
export async function fetchActiveJobs(): Promise<{
  data: JobWithHirer[] | null
  error: Error | null
}> {
  const { data, error } = await supabase
    .from("job_postings")
    .select(
      `
      *,
      hirer:users!hirer_id ( name, avatar_url )
    `,
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })

  console.log("[fetchActiveJobs] Supabase response:", { data, error })

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  const rows = (data ?? []).map((row) =>
    normalizeJobRow(row as Record<string, unknown>),
  )
  return { data: rows, error: null }
}

export async function fetchJobById(id: string): Promise<{
  data: JobWithHirer | null
  error: Error | null
}> {
  const { data, error } = await supabase
    .from("job_postings")
    .select(
      `
      *,
      hirer:users!hirer_id ( name, avatar_url )
    `,
    )
    .eq("id", id)
    .maybeSingle()

  console.log("[fetchJobById] Supabase response:", { id, data, error })

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  if (!data) return { data: null, error: null }
  return {
    data: normalizeJobRow(data as Record<string, unknown>),
    error: null,
  }
}
