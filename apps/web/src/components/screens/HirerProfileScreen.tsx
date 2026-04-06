import { useEffect, useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useClerk, useUser } from "@clerk/clerk-react"
import { MobileShell } from "../MobileShell"
import { supabase } from "../../lib/supabase"

type FieldErrors = {
  name?: string
  phone?: string
}

export function HirerProfileScreen() {
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { user, isSignedIn, isLoaded } = useUser()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      setLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      const { data, error: fetchErr } = await supabase
        .from("users")
        .select("role, name, phone")
        .eq("id", user.id)
        .single()

      console.log("[HirerProfile] Supabase users load:", {
        data,
        error: fetchErr,
        userId: user.id,
      })

      if (cancelled) return

      if (fetchErr) {
        if (fetchErr.code === "PGRST116") {
          navigate("/onboarding", { replace: true })
          return
        }
        setError(fetchErr.message)
        setLoading(false)
        return
      }

      if (!data) {
        setLoading(false)
        return
      }

      if (data.role !== "hirer") {
        navigate(
          data.role === "worker" ? "/worker/feed" : "/onboarding",
          { replace: true },
        )
        return
      }

      setName(data.name ?? user.fullName ?? "")
      setPhone(data.phone ?? user.phoneNumbers?.[0]?.phoneNumber ?? "")
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, user, navigate])

  if (!isLoaded || loading) {
    return (
      <MobileShell className="bg-ocap-black">
        <div className="flex min-h-screen items-center justify-center bg-ocap-black">
          <svg
            className="h-6 w-6 animate-spin text-ocap-lime-feed"
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

  async function handleSave() {
    const u = user
    if (!u) return
    setError(null)
    setSuccess(false)
    if (!validate()) return
    setBusy(true)

    const patch = {
      name: name.trim(),
      phone: phone.trim(),
      avatar_url: u.imageUrl ?? null,
    }

    const { data, error: dbErr } = await supabase
      .from("users")
      .update(patch)
      .eq("id", u.id)
      .select()

    console.log("[HirerProfile] Supabase update users:", {
      data,
      error: dbErr,
      patch,
    })

    if (dbErr) {
      if (dbErr.code === "23505") {
        setError("This phone number is already registered.")
      } else {
        setError(dbErr.message)
      }
      setBusy(false)
      return
    }

    setSuccess(true)
    setBusy(false)
    window.setTimeout(() => setSuccess(false), 3000)
  }

  const email = user.primaryEmailAddress?.emailAddress ?? ""

  return (
    <MobileShell className="bg-ocap-black">
      <div className="flex min-h-screen flex-col bg-ocap-black text-ocap-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ocap-lime-feed px-ocap-x py-4">
          <Link
            to="/hirer"
            className="text-[18px] font-black uppercase tracking-tight text-ocap-lime-feed"
          >
            OCAP
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="max-w-[180px] truncate text-ocap-meta text-white/70 sm:max-w-[240px]">
              {email}
            </span>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/login" })}
              className="shrink-0 border border-ocap-lime-feed bg-transparent px-3 py-2 text-ocap-nav font-extrabold uppercase text-ocap-lime-feed"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="px-ocap-x pb-12 pt-8 md:mx-auto md:w-full md:max-w-[600px]">
          <Link
            to="/hirer"
            className="text-ocap-meta uppercase text-white/50 underline"
          >
            ← Back to dashboard
          </Link>

          <h1 className="mt-6 text-ocap-card-title font-black uppercase text-ocap-white">
            Hirer profile
          </h1>
          <p className="text-ocap-meta mt-2 uppercase text-white/50">
            Company or display name and phone shown to workers on job listings
          </p>

          <div className="mt-8 flex flex-col gap-6">
            <div className="space-y-2">
              <label className="text-ocap-meta font-bold uppercase text-white/70">
                Display / company name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-white/15 bg-ocap-feed-urgent px-4 py-3 text-ocap-post-input font-semibold text-white outline-none placeholder:text-white/35"
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
                className="w-full border border-white/15 bg-ocap-feed-urgent px-4 py-3 text-ocap-post-input font-semibold text-white outline-none placeholder:text-white/35"
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
          {success ? (
            <p className="mt-6 text-ocap-meta font-bold uppercase text-ocap-lime-feed">
              Profile saved
            </p>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
            className="mt-8 w-full bg-ocap-lime-feed py-4 text-ocap-btn uppercase text-ocap-black shadow-ocap-post-btn disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </MobileShell>
  )
}
