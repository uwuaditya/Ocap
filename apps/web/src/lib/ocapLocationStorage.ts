export const LS_LOCATION_GRANTED = "ocap_location_granted"
export const LS_LOCATION_DENIED = "ocap_location_denied"

export function readLocationGranted(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(LS_LOCATION_GRANTED) === "true"
}

export function readLocationDenied(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(LS_LOCATION_DENIED) === "true"
}

export function persistLocationGranted(): void {
  localStorage.setItem(LS_LOCATION_GRANTED, "true")
  localStorage.removeItem(LS_LOCATION_DENIED)
  console.log("[Location] localStorage: granted=true, denied cleared")
}

export function persistLocationDenied(): void {
  localStorage.setItem(LS_LOCATION_DENIED, "true")
  localStorage.removeItem(LS_LOCATION_GRANTED)
  console.log("[Location] localStorage: denied=true, granted cleared")
}
