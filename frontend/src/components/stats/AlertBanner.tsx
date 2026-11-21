import { type CampaignStatsSummary, type StatsOverview } from "@/api/stats"
import { alertStyles, worstAlert } from "@/components/stats/alertStyles"
import { Icon } from "@/components/ui/Icon"
import { formatRate, formatThreshold } from "@/utils/format"

/** Spells out every breached threshold so a manager does not have to hunt for the red number. */
export function AlertBanner({
  overview,
  onSelectCampaign,
}: {
  overview: StatsOverview
  onSelectCampaign: (campaignId: string) => void
}) {
  const { alerts, rates, thresholds, recentCampaigns } = overview
  const flagged: CampaignStatsSummary[] = recentCampaigns.filter(
    (campaign) => campaign.alerts.bounce !== "ok" || campaign.alerts.complaint !== "ok",
  )
  const level = worstAlert(
    alerts.bounce,
    alerts.complaint,
    ...flagged.flatMap((campaign) => [campaign.alerts.bounce, campaign.alerts.complaint]),
  )

  if (level === "ok") return null

  const style = alertStyles[level]
  const lines: string[] = []
  if (alerts.bounce !== "ok") {
    lines.push(
      `Overall bounce rate is ${formatRate(rates.bounce)} (${alertStyles[alerts.bounce].label.toLowerCase()} at ${formatThreshold(thresholds.bounce[alerts.bounce === "critical" ? "critical" : "warning"])}).`,
    )
  }
  if (alerts.complaint !== "ok") {
    lines.push(
      `Overall complaint rate is ${formatRate(rates.complaint)} (${alertStyles[alerts.complaint].label.toLowerCase()} at ${formatThreshold(thresholds.complaint[alerts.complaint === "critical" ? "critical" : "warning"])}).`,
    )
  }

  return (
    <div
      className={`mt-6 flex gap-3 rounded-2xl border p-4 ${style.ring} ${style.badge}`}
      role="alert"
    >
      <span className="mt-0.5 shrink-0">
        <Icon name="alert" size={18} />
      </span>
      <div className="min-w-0 text-xs leading-5">
        <p className="font-bold">
          {level === "critical"
            ? "Sending reputation at risk: a bounce or complaint rate has reached the SES review level."
            : "Bounce or complaint rates need attention."}
        </p>
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {flagged.length > 0 && (
          <p className="mt-1">
            Flagged campaigns:{" "}
            {flagged.map((campaign, index) => (
              <span key={campaign.campaignId}>
                {index > 0 && ", "}
                <button
                  className="font-semibold underline underline-offset-2"
                  onClick={() => onSelectCampaign(campaign.campaignId)}
                >
                  {campaign.name}
                </button>
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  )
}
