import { type AlertLevel } from "@/api/stats"
import { alertStyles } from "@/components/stats/alertStyles"
import { Icon } from "@/components/ui/Icon"

export function AlertBadge({ level }: { level: AlertLevel }) {
  const style = alertStyles[level]
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${style.badge}`}
    >
      {level !== "ok" && <Icon name="alert" size={11} />}
      {style.label}
    </span>
  )
}
