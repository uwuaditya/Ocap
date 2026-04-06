import { NavLink, useLocation } from "react-router-dom"

function NavIconFeed() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"
        fill="currentColor"
      />
    </svg>
  )
}

function NavIconMap() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM10 5.47l4 1.4v11.66l-4-1.4V5.47zm-5 .99l3-1.01v11.7l-3 1.01V6.46zm15 11.08l-3 1.01V6.46l3-1.01v11.08z"
        fill="currentColor"
      />
    </svg>
  )
}

function NavIconJobs2() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.7 2.3 12 5l3 3 2.7-2.7a4 4 0 0 1 2.5 5.5l-7.2 7.2a4 4 0 1 1-5.6-5.6l1.4-1.4-3-3-2.7 2.7a6 6 0 1 0 8.5 8.5l7.2-7.2a6 6 0 0 0-5.1-8.5z"
        fill="currentColor"
      />
    </svg>
  )
}

function NavIconProfile() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
        fill="currentColor"
      />
    </svg>
  )
}

const items = [
  { to: "/worker/feed", label: "Feed", icon: NavIconFeed },
  { to: "/worker/map", label: "Map", icon: NavIconMap },
  { to: "/worker/my-jobs", label: "My Jobs", icon: NavIconJobs2 },
  { to: "/worker/profile", label: "Profile", icon: NavIconProfile },
] as const

export function WorkerBottomNav() {
  const { pathname } = useLocation()
  const mapChrome = pathname.startsWith("/worker/map")

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-20 flex bg-ocap-white md:hidden ${
        mapChrome ? "border-t border-ocap-map-divider" : "border-t border-black/10"
      }`}
    >
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => {
            if (mapChrome) {
              return `flex flex-1 flex-col items-center justify-center gap-1 py-3 ${
                isActive
                  ? "bg-ocap-lime-map text-ocap-black"
                  : "text-ocap-map-muted"
              }`
            }
            return `flex flex-1 flex-col items-center justify-center gap-1 py-3 ${
              isActive
                ? "bg-ocap-lime-feed text-ocap-black"
                : "text-ocap-feed-navInactive"
            }`
          }}
        >
          <Icon />
          <span className="text-ocap-nav uppercase">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function WorkerSidebar() {
  return (
    <aside className="hidden md:flex md:w-[72px] md:shrink-0 md:flex-col md:bg-ocap-black">
      <div className="flex h-14 items-center justify-center border-b border-white/10">
        <span className="text-[13px] font-black uppercase tracking-tight text-[#CCFF00]">
          OCAP
        </span>
      </div>
      <div className="flex flex-1 flex-col">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1.5 py-5 ${
                isActive
                  ? "bg-ocap-lime-feed text-ocap-black"
                  : "text-white/50 hover:text-white/80"
              }`
            }
          >
            <Icon />
            <span className="text-ocap-nav uppercase">{label}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  )
}
