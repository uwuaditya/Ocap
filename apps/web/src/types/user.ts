export type UserRole = "worker" | "hirer"

export type UserRow = {
  id: string
  role: UserRole
  name: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
}

export type WorkerProfileRow = {
  id: string
  skills: string[] | null
  hourly_rate: number | null
  experience_years: number | null
  is_available: boolean | null
  rating: number | null
  date_of_birth: string | null
  no_physical_injuries: boolean | null
  bio: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
}
