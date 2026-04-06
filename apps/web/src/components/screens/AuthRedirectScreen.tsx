import { useEffect } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useUser } from "@clerk/clerk-react"
import { supabase } from "../../lib/supabase"

export function AuthRedirectScreen() {
  const navigate = useNavigate()
  const { user, isSignedIn, isLoaded } = useUser()

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return

    let cancelled = false

    void (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      console.log("[AuthRedirect] Supabase users lookup response:", {
        data,
        error,
        userId: user.id,
      })

      if (cancelled) return

      if (error) {
        if (error.code === "PGRST116") {
          console.log("[AuthRedirect] No users row → /onboarding")
          navigate("/onboarding", { replace: true })
        } else {
          console.error("[AuthRedirect] users lookup error:", error)
          navigate("/onboarding", { replace: true })
        }
        return
      }

      const role = data?.role
      if (!role) {
        console.log("[AuthRedirect] Empty role → /onboarding")
        navigate("/onboarding", { replace: true })
      } else if (role === "hirer") {
        console.log("[AuthRedirect] Hirer → /hirer")
        navigate("/hirer", { replace: true })
      } else {
        console.log("[AuthRedirect] Worker → /worker/feed")
        navigate("/worker/feed", { replace: true })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, user, navigate])

  if (!isLoaded) {
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
