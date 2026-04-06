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
