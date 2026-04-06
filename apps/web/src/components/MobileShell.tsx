import type { ReactNode } from "react"

export function MobileShell({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`min-h-screen w-full ${className}`}>
      {children}
    </div>
  )
}
