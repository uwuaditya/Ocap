import { useEffect, useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"
import { MobileShell } from "../MobileShell"
import { supabase } from "../../lib/supabase"

type FieldErrors = {
  name?: string
  phone?: string
  skills?: string
  hourly_rate?: string
  experience_years?: string
}

function parseSkills(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function OnboardingWorkerProfileScreen() {
  const navigate = useNavigate()
  const { user, isSignedIn, isLoaded } = useUser()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [skills, setSkills] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [experienceYears, setExperienceYears] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      setChecking(false)
      return
    }

    setName(user.fullName ?? "")
    setPhone(user.phoneNumbers?.[0]?.phoneNumber ?? "")

    let cancelled = false
    void (async () => {
      const { data, error: lookupErr } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      console.log("[OnboardingWorkerProfile] prefetch users:", {
        data,
        error: lookupErr,
        userId: user.id,
      })

      if (cancelled) return
      if (data?.role === "worker") {
        navigate("/worker/feed", { replace: true })
        return
      }
      if (data?.role === "hirer") {
        navigate("/hirer", { replace: true })
        return
      }
      setChecking(false)
    })()

    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, user, navigate])

  if (!isLoaded || checking) {
    return (
      <MobileShell>
        <div className="flex min-h-screen items-center justify-center bg-ocap-black">
          <svg
            className="h-6 w-6 animate-spin text-[#CCFF00]"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="4"
            />
            <path
              d="M22 12a10 10 0 0 0-10-10"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </MobileShell>
    )
  }

  if (!isSignedIn || !user) return <Navigate to="/login" replace />

  function validate(): boolean {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = "Name is required"
    if (!phone.trim()) next.phone = "Phone is required"
    const skillList = parseSkills(skills)
    if (skillList.length === 0) {
      next.skills = "Add at least one skill (comma-separated)"
    }
    if (hourlyRate.trim()) {
      const n = Number(hourlyRate)
      if (Number.isNaN(n) || n < 0) {
        next.hourly_rate = "Enter a valid expected hourly rate"
      }
    }
    if (experienceYears.trim()) {
      const y = parseInt(experienceYears, 10)
      if (Number.isNaN(y) || y < 0 || y > 80) {
        next.experience_years = "Enter years of experience (0–80)"
      }
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit() {
    const u = user
    if (!u) return
    setError(null)
    if (!validate()) return
    setBusy(true)

    const skillList = parseSkills(skills)
    const userRow = {
      id: u.id,
      role: "worker" as const,
      name: name.trim(),
      phone: phone.trim(),
      avatar_url: u.imageUrl ?? null,
    }

    const { data: uData, error: uErr } = await supabase
      .from("users")
      .insert(userRow)
      .select()

    console.log("[OnboardingWorkerProfile] Supabase insert users:", {
      data: uData,
      error: uErr,
      userRow,
    })

    if (uErr) {
      if (uErr.code === "23505") {
        const { data: existing } = await supabase
          .from("users")
          .select("role")
          .eq("id", u.id)
          .maybeSingle()
        if (existing?.role === "worker") {
          console.log(
            "[OnboardingWorkerProfile] user row exists → /worker/feed",
          )
          navigate("/worker/feed", { replace: true })
          return
        }
        setError("This phone number is already registered.")
        setBusy(false)
        return
      }
      setError(uErr.message)
      setBusy(false)
      return
    }

    const profileRow = {
      id: u.id,
      skills: skillList,
      hourly_rate: hourlyRate.trim() ? Number(hourlyRate) : null,
      experience_years: experienceYears.trim()
        ? parseInt(experienceYears, 10)
        : null,
      is_available: true,
    }

    const { data: pData, error: pErr } = await supabase
      .from("worker_profiles")
      .insert(profileRow)
      .select()

    console.log("[OnboardingWorkerProfile] Supabase insert worker_profiles:", {
      data: pData,
      error: pErr,
      profileRow,
    })

    if (pErr) {
      setError(pErr.message)
      setBusy(false)
      return
    }

    void u.update({ unsafeMetadata: { role: "worker" } })
    navigate("/worker/feed", { replace: true })
  }

  return (
    <MobileShell>
      <div className="flex min-h-screen flex-col bg-ocap-black px-ocap-x pb-8 pt-16 md:items-center md:justify-center md:pb-0 md:pt-0">
        <div className="w-full md:max-w-[600px]">
          <Link
            to="/onboarding"
            className="text-ocap-meta uppercase text-white/50 underline"
          >
            Back
          </Link>
          <h1 className="mt-6 text-ocap-title font-black uppercase text-[#CCFF00]">
            Worker profile
          </h1>
          <p className="mt-2 text-ocap-label uppercase text-white/60">
            Your details are shown to hirers when you apply
          </p>

          <div className="mt-10 flex flex-col gap-6">
            <div className="space-y-2">
              <label className="text-ocap-meta font-bold uppercase text-white/70">
                Full name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-white/15 bg-white/5 px-4 py-3 text-ocap-post-input font-semibold text-white outline-none placeholder:text-white/35"
                placeholder="Your name"
              />
              {fieldErrors.name ? (
                <p className="text-[12px] font-semibold text-red-400">
                  {fieldErrors.name}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-ocap-meta font-bold uppercase text-white/70">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-white/15 bg-white/5 px-4 py-3 text-ocap-post-input font-semibold text-white outline-none placeholder:text-white/35"
                placeholder="+91…"
              />
              {fieldErrors.phone ? (
                <p className="text-[12px] font-semibold text-red-400">
                  {fieldErrors.phone}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-ocap-meta font-bold uppercase text-white/70">
                Skills (comma-separated)
              </label>
              <textarea
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                rows={3}
                className="w-full resize-none border border-white/15 bg-white/5 px-4 py-3 text-[14px] font-semibold text-white outline-none placeholder:text-white/35"
                placeholder="Mason, tiling, scaffolding…"
              />
              {fieldErrors.skills ? (
                <p className="text-[12px] font-semibold text-red-400">
                  {fieldErrors.skills}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-ocap-meta font-bold uppercase text-white/70">
                Expected hourly rate (₹, optional)
              </label>
              <input
                type="number"
                min={0}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="w-full border border-white/15 bg-white/5 px-4 py-3 text-ocap-post-input font-semibold text-white outline-none placeholder:text-white/35 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder="e.g. 450"
              />
              {fieldErrors.hourly_rate ? (
                <p className="text-[12px] font-semibold text-red-400">
                  {fieldErrors.hourly_rate}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-ocap-meta font-bold uppercase text-white/70">
                Years of experience (optional)
              </label>
              <input
                type="number"
                min={0}
                max={80}
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                className="w-full border border-white/15 bg-white/5 px-4 py-3 text-ocap-post-input font-semibold text-white outline-none placeholder:text-white/35 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder="e.g. 5"
              />
              {fieldErrors.experience_years ? (
                <p className="text-[12px] font-semibold text-red-400">
                  {fieldErrors.experience_years}
                </p>
              ) : null}
            </div>
          </div>

          {error ? (
            <p className="mt-6 text-ocap-meta text-red-400">{error}</p>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSubmit()}
            className="mt-10 w-full bg-[#CCFF00] py-4 text-ocap-btn uppercase text-ocap-black disabled:opacity-50"
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </MobileShell>
  )
}
