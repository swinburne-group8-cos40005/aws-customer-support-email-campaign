import { type AlertLevel } from "@/api/stats"
import { AlertBadge } from "@/components/stats/AlertBadge"
import { alertStyles } from "@/components/stats/alertStyles"
import { formatRate, formatThreshold } from "@/utils/format"

/** A rate with its alert level; the tooltip spells out the thresholds the server used. */
export function RateIndicator({
  rate,
  level,
  threshold,
}: {
  rate: number | null
  level: AlertLevel
  threshold: { warning: number; critical: number }
}) {
  if (rate === null) {
    // No emails sent yet: "no data" must not look like "healthy" (contract §2.6.1).
    return (
      <div className="flex flex-col items-start gap-1" title="No emails have been sent yet">
        <span className="text-xs font-semibold text-[#625E6B]">—</span>
        <span className="rounded-full bg-[#F0EFF2] px-2 py-0.5 text-[10px] font-bold text-[#625E6B]">
          No data
        </span>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col items-start gap-1"
      title={`Warning at ${formatThreshold(threshold.warning)}, critical at ${formatThreshold(threshold.critical)}`}
    >
      <span className={`text-xs font-semibold ${alertStyles[level].text}`}>
        {formatRate(rate)}
      </span>
      <AlertBadge level={level} />
    </div>
  )
}
