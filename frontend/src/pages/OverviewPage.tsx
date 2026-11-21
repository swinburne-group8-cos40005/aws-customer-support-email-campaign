import { useState } from "react"
import { type StatsOverview } from "@/api/stats"
import { AlertBanner } from "@/components/stats/AlertBanner"
import { CampaignStatsPanel } from "@/components/stats/CampaignStatsPanel"
import { ErrorState } from "@/components/stats/ErrorState"
import { RateIndicator } from "@/components/stats/RateIndicator"
import { SendBreakdownBar } from "@/components/stats/SendBreakdownBar"
import { StatCard } from "@/components/stats/StatCard"
import { StatusPill } from "@/components/stats/StatusPill"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { PageIntro } from "@/components/ui/PageIntro"
import { useStatsOverview } from "@/hooks/useStats"
import { formatDateTime, formatNumber, formatRate } from "@/utils/format"

const RECENT_CAMPAIGN_LIMIT = 10

const statusOrder = ["draft", "scheduled", "sending", "completed", "failed", "cancelled"] as const

export function OverviewPage({ onCreate }: { onCreate: () => void }) {
  const { data, error, loading, reload } = useStatsOverview(RECENT_CAMPAIGN_LIMIT)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <main className="mx-auto max-w-[1060px] px-5 py-8 sm:px-8 sm:py-10">
      <PageIntro
        action={
          <div className="flex gap-2">
            <Button onClick={reload} variant="secondary">
              <Icon name="refresh" size={15} /> Refresh
            </Button>
            <Button onClick={onCreate}>
              <Icon name="plus" size={16} /> Create campaign
            </Button>
          </div>
        }
        description="Delivery results, bounce and complaint rates across your campaigns, straight from your sending data."
        eyebrow="Reporting"
        title="Campaign performance"
      />

      {loading && !data && <LoadingState />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <Dashboard
          data={data}
          onSelect={setSelectedId}
          refreshError={error?.message ?? null}
          selectedId={selectedId}
        />
      )}
    </main>
  )
}

function LoadingState() {
  return (
    <div aria-busy="true" className="mt-8">
      <div className="grid gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div className="h-[128px] animate-pulse rounded-2xl border border-[#E3E1E7] bg-white" key={index} />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-[#625E6B]">Loading statistics…</p>
    </div>
  )
}

function Dashboard({
  data,
  selectedId,
  onSelect,
  refreshError,
}: {
  data: StatsOverview
  selectedId: string | null
  onSelect: (campaignId: string | null) => void
  refreshError: string | null
}) {
  const { totals, rates, alerts, thresholds, campaignsByStatus, recentCampaigns } = data

  return (
    <>
      {refreshError && (
        <p className="mt-4 rounded-xl bg-[#FEF3C7] px-4 py-2 text-xs text-[#B45309]" role="status">
          Could not refresh: {refreshError} Showing the last loaded data.
        </p>
      )}

      <AlertBanner onSelectCampaign={onSelect} overview={data} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          hint={`${formatNumber(totals.pending)} emails pending`}
          label="Campaigns"
          value={formatNumber(totals.campaigns)}
        />
        <StatCard
          footer={<SendBreakdownBar counts={totals} />}
          hint={`${formatNumber(totals.sent)} accepted by SES`}
          label="Delivery rate"
          value={formatRate(rates.delivery)}
        />
        <StatCard
          hint={`${formatNumber(totals.bounced)} bounced · warn ${formatRate(thresholds.bounce.warning)}`}
          label="Bounce rate"
          level={alerts.bounce}
          value={formatRate(rates.bounce)}
        />
        <StatCard
          hint={`${formatNumber(totals.complained)} complaints · warn ${formatRate(thresholds.complaint.warning)}`}
          label="Complaint rate"
          level={alerts.complaint}
          value={formatRate(rates.complaint)}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-[#E3E1E7] bg-white p-5 sm:px-6">
        <h2 className="text-sm font-semibold text-[#302D37]">Campaigns by status</h2>
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {statusOrder.map((status) => (
            <li className="flex flex-col gap-1.5" key={status}>
              <StatusPill status={status} />
              <span className="text-xl font-semibold text-[#302D37]">
                {formatNumber(campaignsByStatus[status] ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#E3E1E7] bg-white">
        <div className="flex items-center justify-between border-b border-[#ECEAEF] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-sm font-semibold text-[#302D37]">Recent campaigns</h2>
            <p className="mt-1 text-xs text-[#625E6B]">
              Select a campaign for its full results and status history
            </p>
          </div>
          <p className="hidden text-[11px] text-[#625E6B] sm:block">
            Updated {formatDateTime(data.generatedAt)}
          </p>
        </div>

        {recentCampaigns.length === 0 ? (
          <p className="px-6 py-10 text-center text-xs text-[#625E6B]">
            No campaigns yet. Create one and its results will appear here.
          </p>
        ) : (
          <div className="divide-y divide-[#ECEAEF]">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_100px_minmax(0,1.3fr)_110px_110px] gap-4 px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#625E6B] lg:grid">
              <span>Campaign</span>
              <span>Status</span>
              <span>Successful vs failed</span>
              <span>Bounce</span>
              <span>Complaint</span>
            </div>
            {recentCampaigns.map((campaign) => (
              <button
                aria-pressed={selectedId === campaign.campaignId}
                className={`grid w-full grid-cols-1 items-center gap-3 px-5 py-4 text-left transition hover:bg-[#F8F7FB] sm:px-6 lg:grid-cols-[minmax(0,1.6fr)_100px_minmax(0,1.3fr)_110px_110px] lg:gap-4 ${
                  selectedId === campaign.campaignId ? "bg-[#FFF7F7]" : ""
                }`}
                key={campaign.campaignId}
                onClick={() =>
                  onSelect(selectedId === campaign.campaignId ? null : campaign.campaignId)
                }
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#FEE2E2] text-[#B91C1C]">
                    <Icon name="mail" size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#3D3945]">{campaign.name}</p>
                    <p className="mt-0.5 text-[11px] text-[#625E6B]">
                      {campaign.scheduledAt
                        ? formatDateTime(campaign.scheduledAt)
                        : "Not scheduled"}
                    </p>
                  </div>
                </div>
                <StatusPill status={campaign.status} />
                <SendBreakdownBar counts={campaign.counts} />
                <RateIndicator
                  level={campaign.alerts.bounce}
                  rate={campaign.rates.bounce}
                  threshold={thresholds.bounce}
                />
                <RateIndicator
                  level={campaign.alerts.complaint}
                  rate={campaign.rates.complaint}
                  threshold={thresholds.complaint}
                />
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedId && (
        <CampaignStatsPanel campaignId={selectedId} onClose={() => onSelect(null)} />
      )}
    </>
  )
}
