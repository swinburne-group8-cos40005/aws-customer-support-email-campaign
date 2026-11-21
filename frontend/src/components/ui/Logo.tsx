import { Icon } from "@/components/ui/Icon"

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex size-9 items-center justify-center rounded-xl bg-[#DC2626] text-white shadow-[0_8px_20px_rgba(220,38,38,.3)]">
        <Icon name="paper-plane" size={18} />
      </div>
      {!compact && (
        <span className="text-[20px] font-bold tracking-[-0.03em] text-[#20202B]">
          PostlyMail
        </span>
      )}
    </div>
  )
}
