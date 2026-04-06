import { distanceKm, parseGeographyPoint, WORKER_REFERENCE } from "./geo"
import type { JobWithHirer } from "../types/job"

export function jobDistanceKm(
  job: JobWithHirer,
  ref: { lat: number; lng: number } = WORKER_REFERENCE,
): number | null {
  const pt = parseGeographyPoint(job.location)
  if (!pt) return null
  return Math.round(distanceKm(ref, pt) * 10) / 10
}

export function formatKmAway(km: number | null): string {
  if (km == null) return "—"
  return `${km} km away`
}

const durationRe = /duration:\s*(\d+)\s*days?/i

export function mapDurationLabel(description: string | null): string {
  if (!description) return "—"
  const m = description.match(durationRe)
  if (m) return `${m[1]} days`
  return "—"
}

export function feedScheduleLine(job: JobWithHirer): {
  icon: "cal" | "clock"
  text: string
} {
  const d = (job.description ?? "").toLowerCase()
  if (d.includes("night shift"))
    return { icon: "clock", text: "Night shift" }

  if (job.shift_start && job.start_date) {
    const [hh, mm] = job.shift_start.split(":").map(Number)
    const h12 = hh % 12 || 12
    const ampm = hh < 12 ? "am" : "pm"
    const mmPadded = String(mm).padStart(2, "0")
    return {
      icon: "cal",
      text: `Today, ${h12}:${mmPadded} ${ampm}`,
    }
  }
  return { icon: "cal", text: "Schedule TBC" }
}

export function rateBadgeText(job: JobWithHirer): string {
  if (job.is_fixed_rate && job.fixed_rate != null) {
    return `₹${Number(job.fixed_rate).toLocaleString("en-IN")}`
  }
  if (job.hourly_rate != null) {
    return `₹${Number(job.hourly_rate)}/hr`
  }
  return "—"
}

export function isFixedRate(job: JobWithHirer): boolean {
  return Boolean(job.is_fixed_rate && job.fixed_rate != null)
}
