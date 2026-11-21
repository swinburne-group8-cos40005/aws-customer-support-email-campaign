import { type CampaignStatus } from "@/api/stats"
import { statusStyles } from "@/components/stats/alertStyles"

export function StatusPill({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${statusStyles[status]}`}
    >
      {status}
    </span>
  )
}
