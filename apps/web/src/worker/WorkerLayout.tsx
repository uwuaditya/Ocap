import { Outlet, useLocation } from "react-router-dom"
import { WorkerBottomNav, WorkerSidebar } from "./WorkerBottomNav"
import { WorkerJobsProvider } from "./WorkerJobsContext"
import { useEffect, useRef } from "react"
import { useUser } from "@clerk/clerk-react"
import { upsertWorkerLocation } from "../lib/workerLocation"

export function WorkerLayout() {
  const { pathname } = useLocation()
  const hideNav = pathname.includes("/worker/job/")
  const { user, isLoaded } = useUser()
  const lastSentAt = useRef(0)

  useEffect(() => {
    if (!isLoaded || !user?.id) return
    if (!("geolocation" in navigator)) return

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now()
        if (now - lastSentAt.current < 15000) return
        lastSentAt.current = now
        void upsertWorkerLocation({
          workerId: user.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      },
      () => {
        // ignore (permission denied / unavailable)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    )

    return () => {
      navigator.geolocation.clearWatch(id)
    }
  }, [isLoaded, user?.id])

  return (
    <WorkerJobsProvider>
      <div className="flex min-h-screen">
        {!hideNav && <WorkerSidebar />}
        <div
          className={`relative flex flex-1 flex-col ${hideNav ? "" : "pb-[72px] md:pb-0"}`}
        >
          <Outlet />
        </div>
        {!hideNav && <WorkerBottomNav />}
      </div>
    </WorkerJobsProvider>
  )
}
