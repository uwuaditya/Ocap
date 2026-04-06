/** Nominatim reverse lookup; use sparingly (fair-use policy). */
export async function reverseGeocodeArea(
  lat: number,
  lng: number,
): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
  const r = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      "User-Agent": "OCAP-ConstructionApp/1.0 (worker map & feed)",
    },
  })
  if (!r.ok) throw new Error(String(r.status))
  const data = (await r.json()) as {
    address?: Record<string, string>
  }
  const a = data.address ?? {}
  const area =
    a.suburb ||
    a.neighbourhood ||
    a.city_district ||
    a.city ||
    a.town ||
    a.village ||
    "Your location"
  return area.toUpperCase()
}
