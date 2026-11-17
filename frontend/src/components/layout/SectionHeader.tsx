import { Icon } from "@/components/ui/Icon"
import { ThemeToggle } from "@/components/ui/ThemeToggle"

/** Sticky top bar for the non-wizard views (overview, templates, audience, settings, help). */
export function SectionHeader({
  eyebrow,
  title,
  darkMode,
  onBack,
  onToggleTheme,
}: {
  eyebrow: string
  title: string
  darkMode: boolean
  onBack: () => void
  onToggleTheme: () => void
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between border-b border-[#E7E5EB] bg-white/95 px-5 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-8">
      <div className="flex items-center gap-3">
        <button
          aria-label="Back to campaigns"
          className="flex size-9 items-center justify-center rounded-[10px] text-[#625E6B] hover:bg-[#F3F1F6] lg:hidden"
          onClick={onBack}
        >
          <Icon name="arrow-left" size={18} />
        </button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#625E6B]">
            {eyebrow}
          </p>
          <h1 className="text-[15px] font-semibold text-[#33303B]">{title}</h1>
        </div>
      </div>
      <ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} />
    </header>
  )
}
