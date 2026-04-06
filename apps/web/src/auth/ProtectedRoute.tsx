import { useAuth, useUser } from "@clerk/clerk-react"
import { useEffect, useState } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { supabase } from "../lib/supabase"

type Gate = "idle" | "loading" | "ok" | "no-profile"

export function ProtectedRoute() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth()
  const { user, isLoaded: userLoaded } = useUser()
  const location = useLocation()
  const [gate, setGate] = useState<Gate>("idle")

  const onOnboarding = location.pathname.startsWith("/onboarding")

  useEffect(() => {
    if (!authLoaded || !userLoaded) return
    if (!isSignedIn || !user) {
      setGate("idle")
      return
    }

    if (onOnboarding) {
      setGate("ok")
      return
    }

    let cancelled = false
    setGate("loading")

    void (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      console.log("[ProtectedRoute] Supabase users lookup response:", {
        data,
        error,
        userId: user.id,
      })

      if (cancelled) return

      if (error) {
        if (error.code === "PGRST116") {
          setGate("no-profile")
        } else {
          console.error("[ProtectedRoute] users lookup failed:", error)
          setGate("no-profile")
        }
        return
      }

      if (!data?.role) {
        setGate("no-profile")
      } else {
        setGate("ok")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    authLoaded,
    userLoaded,
    isSignedIn,
    user?.id,
    onOnboarding,
    location.pathname,
  ])

  if (!authLoaded || !userLoaded) {
    return (
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
    )
  }

  if (!isSignedIn || !user) {
    return <Navigate to="/login" replace />
  }

  if (onOnboarding) {
    return <Outlet />
  }

  if (gate === "loading" || gate === "idle") {
    return (
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
    )
  }

  if (gate === "no-profile") {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
