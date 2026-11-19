import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { ThemeToggle } from "@/components/ui/ThemeToggle"

/** Top bar of the campaign wizard: draft status, theme toggle and quick actions. */
export function CampaignHeader({
  darkMode,
  onToggleTheme,
  onOpenSettings,
}: {
  darkMode: boolean
  onToggleTheme: () => void
  onOpenSettings: () => void
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between border-b border-[#E7E5EB] bg-white/95 px-5 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-8">
      <div className="flex items-center gap-3">
        <button className="text-[#6E6A78] lg:hidden">
          <Icon name="menu" size={20} />
        </button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#625E6B]">
            Campaigns
          </p>
          <h1 className="text-[15px] font-semibold text-[#33303B]">
            Create campaign
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="mr-2 hidden items-center gap-1.5 text-xs text-[#625E6B] sm:flex">
          <span className="size-1.5 rounded-full bg-[#55B984]" /> Draft saved
        </span>
        <ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} />
        <button
          aria-label="Open settings"
          className="flex size-9 items-center justify-center rounded-[10px] border border-[#E3E2EA] bg-white text-[#625E6B] transition hover:bg-[#F8F7FB] lg:hidden"
          onClick={onOpenSettings}
        >
          <Icon name="settings" size={17} />
        </button>
        <Button variant="secondary" className="hidden sm:inline-flex">
          Save & exit
        </Button>
        <button className="flex size-9 items-center justify-center rounded-[10px] text-[#777381] hover:bg-[#F3F1F6]">
          <Icon name="more" size={19} />
        </button>
      </div>
    </header>
  )
}
