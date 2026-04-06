/** Reference point for "km away" copy (Rohini, DL). */
export const WORKER_REFERENCE = { lat: 28.7075, lng: 77.1025 }

function toRadians(deg: number) {
  return (deg * Math.PI) / 180
}

/** Haversine distance in kilometres between two WGS84 points. */
export function getDistanceKm(
  userLat: number,
  userLng: number,
  jobLat: number,
  jobLng: number,
): number {
  return distanceKm(
    { lat: userLat, lng: userLng },
    { lat: jobLat, lng: jobLng },
  )
}

/** Haversine distance in kilometres. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const la = toRadians(a.lat)
  const lb = toRadians(b.lat)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function parseGeographyPoint(
  raw: unknown,
): { lat: number; lng: number } | null {
  if (raw == null) return null
  if (typeof raw === "string") {
    const m = raw.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i)
    if (m) return { lng: Number(m[1]), lat: Number(m[2]) }
    return null
  }
  if (typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (o.type === "Point" && Array.isArray(o.coordinates)) {
    const [lng, lat] = o.coordinates as [number, number]
    if (typeof lat === "number" && typeof lng === "number")
      return { lat, lng }
  }
  return null
}

function safeTimeParts(t: string | null | undefined): { hh: number; mm: number } | null {
  if (!t) return null
  const parts = t.split(":")
  const hh = parseInt(parts[0] ?? "", 10)
  const mm = parseInt(parts[1] ?? "", 10)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return { hh, mm }
}

function localDateTime(startDate: string, shiftStart: string): Date | null {
  // startDate: YYYY-MM-DD (Supabase date)
  const dParts = startDate.split("-").map((x) => parseInt(x, 10))
  if (dParts.length !== 3) return null
  const [y, m, d] = dParts
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const t = safeTimeParts(shiftStart)
  if (!t) return null
  return new Date(y, m - 1, d, t.hh, t.mm, 0, 0)
}

/**
 * "Uber-style" time-to-start label for the Job Detail timer strip.
 * Returns one of:
 * - "2h 34m" (under 24h)
 * - "3 DAYS" (1+ days)
 * - "IN PROGRESS" (start time passed)
 * - "SCHEDULE TBC" (missing date/time)
 */
export function getTimeUntil(
  startDate: string | null,
  shiftStart: string | null,
): string {
  if (!startDate || !shiftStart) return "SCHEDULE TBC"
  const start = localDateTime(startDate, shiftStart)
  if (!start) return "SCHEDULE TBC"

  const diffMs = start.getTime() - Date.now()
  if (diffMs <= 0) return "IN PROGRESS"

  const diffMin = Math.round(diffMs / 60000)
  const diffDays = Math.floor(diffMin / 1440)
  if (diffDays >= 1) {
    return `${diffDays} DAY${diffDays === 1 ? "" : "S"}`
  }
  const h = Math.floor(diffMin / 60)
  const m = Math.max(0, diffMin % 60)
  return `${h}h ${m}m`
}
