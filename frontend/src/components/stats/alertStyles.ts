import { type AlertLevel, type CampaignStatus } from "@/api/stats"

/** One visual language for rate alerts: colour + words, never colour alone (US05). */
export const alertStyles: Record<
  AlertLevel,
  { label: string; badge: string; text: string; ring: string }
> = {
  ok: {
    label: "Healthy",
    badge: "bg-[#DEF5E7] text-[#247A4D]",
    text: "text-[#247A4D]",
    ring: "border-[#E3E1E7]",
  },
  warning: {
    label: "Warning",
    badge: "bg-[#FEF3C7] text-[#B45309]",
    text: "text-[#B45309]",
    ring: "border-[#F5C46A]",
  },
  critical: {
    label: "Critical",
    badge: "bg-[#FEE2E2] text-[#B91C1C]",
    text: "text-[#B91C1C]",
    ring: "border-[#F3A5A5]",
  },
}

export const statusStyles: Record<CampaignStatus, string> = {
  draft: "bg-[#F0EFF2] text-[#625E6B]",
  scheduled: "bg-[#E0ECFF] text-[#1D4ED8]",
  sending: "bg-[#FEF3C7] text-[#B45309]",
  completed: "bg-[#DEF5E7] text-[#247A4D]",
  failed: "bg-[#FEE2E2] text-[#B91C1C]",
  cancelled: "bg-[#F0EFF2] text-[#625E6B]",
}

const severity: Record<AlertLevel, number> = { ok: 0, warning: 1, critical: 2 }

export function worstAlert(...levels: AlertLevel[]): AlertLevel {
  return levels.reduce<AlertLevel>(
    (worst, level) => (severity[level] > severity[worst] ? level : worst),
    "ok",
  )
}
