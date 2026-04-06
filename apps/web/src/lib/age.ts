/** `dob` is an ISO date string `YYYY-MM-DD`. */
export function ageFromDob(dob: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const birth = new Date(y, mo, d)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const md = today.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

export function isAtLeastAge(dob: string, minAge: number): boolean {
  const age = ageFromDob(dob)
  return age != null && age >= minAge
}
