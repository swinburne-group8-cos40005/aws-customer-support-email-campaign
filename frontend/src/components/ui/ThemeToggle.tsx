import { Icon } from "@/components/ui/Icon"

export function ThemeToggle({
  darkMode,
  onToggle,
}: {
  darkMode: boolean
  onToggle: () => void
}) {
  return (
    <button
      aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}
      className="theme-toggle flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E3E2EA] bg-white text-[#6D6979] transition hover:border-[#CAC7D5] hover:bg-[#F8F7FB]"
      onClick={onToggle}
      title={`Switch to ${darkMode ? "light" : "dark"} mode`}
      type="button"
    >
      <Icon name={darkMode ? "sun" : "moon"} size={17} />
    </button>
  )
}
