import { useEffect, useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"
import { MobileShell } from "../MobileShell"
import { supabase } from "../../lib/supabase"

type FieldErrors = {
  name?: string
  phone?: string
}

export function OnboardingHirerProfileScreen() {
  const navigate = useNavigate()
  const { user, isSignedIn, isLoaded } = useUser()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
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

      console.log("[OnboardingHirerProfile] prefetch users:", {
        data,
        error: lookupErr,
        userId: user.id,
      })

      if (cancelled) return
      if (data?.role === "hirer") {
        navigate("/hirer", { replace: true })
        return
      }
      if (data?.role === "worker") {
        navigate("/worker/feed", { replace: true })
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
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit() {
    const u = user
    if (!u) return
    setError(null)
    if (!validate()) return
    setBusy(true)

    const row = {
      id: u.id,
      role: "hirer" as const,
      name: name.trim(),
      phone: phone.trim(),
      avatar_url: u.imageUrl ?? null,
    }

    const { data, error: dbErr } = await supabase
      .from("users")
      .insert(row)
      .select()

    console.log("[OnboardingHirerProfile] Supabase insert users:", {
      data,
      error: dbErr,
      row,
    })

    if (dbErr) {
      if (dbErr.code === "23505") {
        const { data: existing } = await supabase
          .from("users")
          .select("role")
          .eq("id", u.id)
          .maybeSingle()
        if (existing?.role === "hirer") {
          console.log("[OnboardingHirerProfile] user row exists → /hirer")
          navigate("/hirer", { replace: true })
          return
        }
        setError("This phone number is already registered.")
        setBusy(false)
        return
      }
      setError(dbErr.message)
      setBusy(false)
      return
    }

    void u.update({ unsafeMetadata: { role: "hirer" } })
    navigate("/hirer", { replace: true })
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
            Hirer profile
          </h1>
          <p className="mt-2 text-ocap-label uppercase text-white/60">
            Tell us how to reach you for your job sites
          </p>

          <div className="mt-10 flex flex-col gap-6">
            <div className="space-y-2">
              <label className="text-ocap-meta font-bold uppercase text-white/70">
                Display / company name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-white/15 bg-white/5 px-4 py-3 text-ocap-post-input font-semibold text-white outline-none placeholder:text-white/35"
                placeholder="e.g. Khanna Constructions"
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
