import { type EmailCounts } from "@/api/stats"
import { formatNumber } from "@/utils/format"

const segments = [
  { key: "delivered", label: "Delivered", color: "bg-[#34A56F]" },
  { key: "complained", label: "Complained", color: "bg-[#E0A21B]" },
  { key: "bounced", label: "Bounced", color: "bg-[#EA7B2C]" },
  { key: "failed", label: "Failed", color: "bg-[#DC2626]" },
  { key: "pending", label: "Pending", color: "bg-[#C9C6D1]" },
] as const

/**
 * Successful vs failed sends at a glance. "Successful" is delivered mail;
 * "failed" is mail that bounced or never reached SES. The bar is split by
 * all five outcomes so nothing is hidden inside the two headline numbers.
 */
export function SendBreakdownBar({
  counts,
  showLegend = false,
}: {
  counts: EmailCounts
  showLegend?: boolean
}) {
  const total =
    counts.delivered + counts.complained + counts.bounced + counts.failed + counts.pending
  const successful = counts.delivered
  const failedTotal = counts.bounced + counts.failed

  return (
    <div className="min-w-0">
      <div
        aria-label={`${formatNumber(successful)} successful, ${formatNumber(failedTotal)} failed`}
        className="flex h-2 w-full overflow-hidden rounded-full bg-[#F0EFF2]"
        role="img"
      >
        {total > 0 &&
          segments.map(({ key, label, color }) =>
            counts[key] > 0 ? (
              <span
                className={color}
                key={key}
                style={{ width: `${(counts[key] / total) * 100}%` }}
                title={`${label}: ${formatNumber(counts[key])}`}
              />
            ) : null,
          )}
      </div>
      <p className="mt-1.5 text-[11px] text-[#625E6B]">
        <span className="font-semibold text-[#247A4D]">{formatNumber(successful)}</span> successful
        {" · "}
        <span className={`font-semibold ${failedTotal > 0 ? "text-[#B91C1C]" : "text-[#625E6B]"}`}>
          {formatNumber(failedTotal)}
        </span>{" "}
        failed
      </p>
      {showLegend && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {segments.map(({ key, label, color }) => (
            <li className="flex items-center gap-1.5 text-[11px] text-[#625E6B]" key={key}>
              <span className={`size-2 rounded-full ${color}`} />
              {label} <span className="font-semibold text-[#3D3945]">{formatNumber(counts[key])}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
