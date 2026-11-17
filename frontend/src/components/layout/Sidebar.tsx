import { Icon } from "@/components/ui/Icon"
import { Logo } from "@/components/ui/Logo"
import { navItems } from "@/data/navItems"
import { type AppView } from "@/types"

export function Sidebar({
  onLogout,
  view,
  onViewChange,
}: {
  onLogout: () => void
  view: AppView
  onViewChange: (view: AppView) => void
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-[#E8E6ED] bg-white px-4 py-6 lg:flex lg:flex-col">
      <div className="px-2">
        <Logo />
      </div>
      <nav className="mt-9 space-y-1">
        {navItems.map((item) => (
          <button
            className={`flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium transition ${
              item.view === view
                ? "bg-[#FEE2E2] text-[#C81E1E]"
                : "text-[#716D7C] hover:bg-[#F7F6F9] hover:text-[#33313F]"
            }`}
            key={item.label}
            onClick={() => onViewChange(item.view)}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="mt-7 border-t border-[#ECEAF0] pt-7">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#625E6B]">
          Workspace
        </p>
        <button
          className={`flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium transition ${
            view === "settings"
              ? "bg-[#FEE2E2] text-[#C81E1E]"
              : "text-[#716D7C] hover:bg-[#F7F6F9] hover:text-[#33313F]"
          }`}
          onClick={() => onViewChange("settings")}
        >
          <Icon name="settings" size={18} /> Settings
        </button>
        <button
          className={`flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium transition ${
            view === "help"
              ? "bg-[#FEE2E2] text-[#C81E1E]"
              : "text-[#716D7C] hover:bg-[#F7F6F9] hover:text-[#33313F]"
          }`}
          onClick={() => onViewChange("help")}
        >
          <Icon name="help" size={18} /> Help Center
        </button>
      </div>
      <div className="mt-auto rounded-xl bg-[#F7F6F9] p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#D8F7E5] text-xs font-bold text-black">
            TH
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-[#33313F]">
              Trong Hieu
            </p>
            <p className="truncate text-[11px] text-[#625E6B]">Administrator</p>
          </div>
          <button
            className="text-[#625E6B] hover:text-[#403C49]"
            onClick={onLogout}
            title="Sign out"
          >
            <Icon name="logout" size={17} />
          </button>
        </div>
      </div>
    </aside>
  )
}
