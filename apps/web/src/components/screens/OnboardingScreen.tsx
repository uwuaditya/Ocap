import { useEffect, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"
import { MobileShell } from "../MobileShell"
import { supabase } from "../../lib/supabase"

/** Step 1: choose role → `/onboarding/worker` or `/onboarding/hirer` to save profile + DB row. */

export function OnboardingScreen() {
  const navigate = useNavigate()
  const { user, isSignedIn, isLoaded } = useUser()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [existingDbRole, setExistingDbRole] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      setProfileLoading(false)
      return
    }

    let cancelled = false

    void (async () => {
      const { data, error: lookupErr } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      console.log("[Onboarding] Supabase users prefetch response:", {
        data,
        error: lookupErr,
        userId: user.id,
      })

      if (cancelled) return

      if (lookupErr && lookupErr.code !== "PGRST116") {
        console.error("[Onboarding] users prefetch error:", lookupErr)
      }

      if (data?.role) {
        setExistingDbRole(data.role)
      }
      setProfileLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, user])

  if (!isLoaded || profileLoading) {
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

  if (existingDbRole) {
    return (
      <Navigate
        to={existingDbRole === "hirer" ? "/hirer" : "/worker/feed"}
        replace
      />
    )
  }

  async function handleSelect(selectedRole: "worker" | "hirer") {
    setBusy(true)
    setError(null)
    try {
      await user!.update({ unsafeMetadata: { role: selectedRole } })
      navigate(
        selectedRole === "hirer" ? "/onboarding/hirer" : "/onboarding/worker",
        { replace: true },
      )
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Something went wrong")
      setBusy(false)
    }
  }

  return (
    <MobileShell>
      <div className="flex min-h-screen flex-col bg-ocap-black px-ocap-x pb-8 pt-16 md:items-center md:justify-center md:pb-0 md:pt-0">
        <div className="w-full md:max-w-[600px]">
          <h1 className="text-ocap-title font-black uppercase text-[#CCFF00]">
            OCAP
          </h1>
          <p className="mt-2 text-ocap-label uppercase text-white/50">
            Step 1 of 2 — choose how you use OCAP
          </p>

          <h2 className="mt-16 text-ocap-card-title font-black uppercase text-white md:mt-10">
            I am…
          </h2>

          <div className="mt-6 flex flex-col gap-4 md:flex-row">
            <button
              type="button"
              onClick={() => void handleSelect("worker")}
              disabled={busy}
              className="flex flex-col gap-2 border border-white/10 bg-white/5 p-ocap-card text-left disabled:opacity-50 md:flex-1"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M2 21h20v-2H2v2zm2-4h3v-4H4v4zm5 0h3v-9H9v9zm5 0h3v-6h-3v6zm5 0h3v-12h-3v12z"
                  fill="#CCFF00"
                />
              </svg>
              <span className="text-ocap-card-title font-black uppercase text-[#CCFF00]">
                I'm looking for work
              </span>
              <span className="text-ocap-meta text-white/50">
                Browse gigs, apply, and get hired
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleSelect("hirer")}
              disabled={busy}
              className="flex flex-col gap-2 border border-white/10 bg-white/5 p-ocap-card text-left disabled:opacity-50 md:flex-1"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4zm10 15H4V8h16v11z"
                  fill="#CCFF00"
                />
              </svg>
              <span className="text-ocap-card-title font-black uppercase text-[#CCFF00]">
                I'm hiring
              </span>
              <span className="text-ocap-meta text-white/50">
                Post jobs and find skilled labor
              </span>
            </button>
          </div>

          {error && <p className="mt-4 text-ocap-meta text-red-400">{error}</p>}
        </div>
      </div>
    </MobileShell>
  )
}
