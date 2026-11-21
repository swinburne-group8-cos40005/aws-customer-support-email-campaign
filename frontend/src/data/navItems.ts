import { type IconName } from "@/components/ui/Icon"
import { type AppView } from "@/types"

export const navItems: Array<{ label: string; icon: IconName; view: AppView }> = [
  { label: "Overview", icon: "grid", view: "overview" },
  { label: "Campaigns", icon: "campaign", view: "campaign" },
  { label: "Templates", icon: "layers", view: "templates" },
  { label: "Audience", icon: "audience", view: "audience" },
  { label: "Audit Logs", icon: "clock", view: "audit-logs" },
]
