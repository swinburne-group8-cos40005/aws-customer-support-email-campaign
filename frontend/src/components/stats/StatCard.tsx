import { type ReactNode } from "react"
import { type AlertLevel } from "@/api/stats"
import { AlertBadge } from "@/components/stats/AlertBadge"
import { alertStyles } from "@/components/stats/alertStyles"

export function StatCard({
  label,
  value,
  hint,
  level,
  footer,
}: {
  label: string
  value: string
  hint?: string
  level?: AlertLevel
  footer?: ReactNode
}) {
  const style = level ? alertStyles[level] : null
  return (
    <section
      className={`rounded-2xl border bg-white p-5 ${style?.ring ?? "border-[#E3E1E7]"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-[#625E6B]">{label}</p>
        {level && <AlertBadge level={level} />}
      </div>
      <p className={`mt-3 text-[26px] font-semibold tracking-[-0.04em] ${style?.text ?? "text-[#302D37]"}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-[#625E6B]">{hint}</p>}
      {footer && <div className="mt-4">{footer}</div>}
    </section>
  )
}
