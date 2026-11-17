import { type ReactNode } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { type AppView } from "@/types"

/** Themed page frame with the fixed sidebar; every signed-in screen renders inside it. */
export function AppShell({
  darkMode,
  view,
  onViewChange,
  onLogout,
  children,
}: {
  darkMode: boolean
  view: AppView
  onViewChange: (view: AppView) => void
  onLogout: () => void
  children: ReactNode
}) {
  return (
    <div
      className={`${
        darkMode ? "theme-dark" : ""
      } min-h-screen bg-[#F7F7F9] transition-colors lg:pl-[232px]`}
    >
      <Sidebar onLogout={onLogout} onViewChange={onViewChange} view={view} />
      {children}
    </div>
  )
}
