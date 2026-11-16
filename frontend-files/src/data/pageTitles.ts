import { type AppView } from "@/types"

/** Header titles for every view that isn't the campaign wizard. */
export const pageTitles: Record<Exclude<AppView, "campaign">, string> = {
  overview: "Workspace overview",
  templates: "Template library",
  audience: "Audience management",
  settings: "Workspace settings",
  help: "Help Center",
}
