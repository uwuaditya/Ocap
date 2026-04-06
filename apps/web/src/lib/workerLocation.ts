import { supabase } from "./supabase"
import type { WorkerLocationRow } from "../types/job"

export async function upsertWorkerLocation(input: {
  workerId: string
  lat: number
  lng: number
}): Promise<{ data: WorkerLocationRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("worker_locations")
    .upsert(
      {
        worker_id: input.workerId,
        lat: input.lat,
        lng: input.lng,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "worker_id" },
    )
    .select()
    .single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: data as WorkerLocationRow, error: null }
}

export async function fetchWorkerLocations(workerIds: string[]): Promise<{
  data: WorkerLocationRow[]
  error: Error | null
}> {
  if (workerIds.length === 0) return { data: [], error: null }

  const { data, error } = await supabase
    .from("worker_locations")
    .select("worker_id, lat, lng, updated_at")
    .in("worker_id", workerIds)

  if (error) return { data: [], error: new Error(error.message) }
  return { data: (data ?? []) as WorkerLocationRow[], error: null }
}

