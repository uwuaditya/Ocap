import { Outlet, useLocation } from "react-router-dom"
import { WorkerBottomNav, WorkerSidebar } from "./WorkerBottomNav"
import { WorkerJobsProvider } from "./WorkerJobsContext"

export function WorkerLayout() {
  const { pathname } = useLocation()
  const hideNav = pathname.includes("/worker/job/")

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
