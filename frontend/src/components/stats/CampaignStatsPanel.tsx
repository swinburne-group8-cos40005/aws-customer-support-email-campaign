import { useEffect, useState } from "react"
import { campaignApi, type CampaignDeliveryLog } from "@/lib/api"
import { type CampaignStats } from "@/api/stats"
import { RateIndicator } from "@/components/stats/RateIndicator"
import { SendBreakdownBar } from "@/components/stats/SendBreakdownBar"
import { StatusPill } from "@/components/stats/StatusPill"
import { Icon } from "@/components/ui/Icon"
import { useCampaignStats } from "@/hooks/useStats"
import { formatDateTime, formatNumber, formatRate } from "@/utils/format"
import { ErrorState } from "@/components/stats/ErrorState"

/** Drill-down for one campaign: counters, rates vs thresholds, send outcomes and status history. */
export function CampaignStatsPanel({
  campaignId,
  onClose,
}: {
  campaignId: string
  onClose: () => void
}) {
  const { data, error, loading, reload } = useCampaignStats(campaignId)

  return (
    <section
      aria-label="Campaign details"
      className="mt-6 rounded-2xl border border-[#E3E1E7] bg-white"
    >
      <div className="flex items-center justify-between border-b border-[#ECEAEF] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-[#302D37]">
            {data?.name ?? "Campaign details"}
          </h2>
          <p className="mt-1 text-xs text-[#625E6B]">Delivery results and status history</p>
        </div>
        <button
          aria-label="Close campaign details"
          className="rounded-lg px-2 py-1 text-xs font-semibold text-[#625E6B] hover:bg-[#F0EFF2]"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {loading && !data && (
        <p className="px-6 py-8 text-center text-xs text-[#625E6B]">Loading campaign statistics…</p>
      )}
      {error && <ErrorState error={error} onRetry={reload} compact />}
      {data && <PanelBody stats={data} campaignId={campaignId} />}
    </section>
  )
}

function CampaignDeliveryLogs({ campaignId }: { campaignId: string }) {
  const [logs, setLogs] = useState<CampaignDeliveryLog[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [history, setHistory] = useState<Array<string | undefined>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function load(next?: string) {
    setLoading(true)
    setError("")
    try {
      const result = await campaignApi.campaignDeliveryLogs(campaignId, next, 20)
      setLogs(result.data)
      setNextCursor(result.nextCursor)
      setCursor(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load delivery logs.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setHistory([])
    void load(undefined)
    // Load only when the selected campaign changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  function nextPage() {
    if (!nextCursor) return
    setHistory((items) => [...items, cursor])
    void load(nextCursor)
  }

  function previousPage() {
    if (!history.length) return
    const previous = history[history.length - 1]
    setHistory((items) => items.slice(0, -1))
    void load(previous)
  }

  return (
    <section className="mt-6 border-t border-[#E3E1E7] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-[#302D37]">Recipient delivery logs</h3>
          <p className="mt-1 text-[11px] text-[#625E6B]">Per-recipient delivery status for this campaign</p>
        </div>
        <button onClick={() => void load(cursor)} disabled={loading} className="text-xs font-semibold text-[#B91C1C] disabled:opacity-50">Refresh</button>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      {loading ? <p className="py-5 text-center text-xs text-[#625E6B]">Loading recipient logs…</p>
        : logs.length === 0 ? <p className="py-5 text-center text-xs text-[#625E6B]">No recipient logs found.</p>
        : <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b text-[10px] uppercase text-[#777382]"><th className="py-2 pr-3">Recipient</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Updated</th><th className="py-2">Details</th></tr></thead>
            <tbody>{logs.map((entry, index) => <tr key={entry.id ?? entry.logId ?? `${entry.customerId ?? entry.recipientId ?? entry.email ?? "recipient"}-${index}`} className="border-b last:border-0">
              <td className="break-all py-3 pr-3 text-[#403C49]">{entry.recipientEmail ?? entry.email ?? entry.customerId ?? entry.recipientId ?? "Unknown recipient"}</td>
              <td className="py-3 pr-3"><span className="rounded-full bg-[#F3F1F8] px-2 py-1 font-semibold">{entry.status}</span></td>
              <td className="whitespace-nowrap py-3 pr-3 text-[#625E6B]">{entry.updatedAt ?? entry.sentAt ?? entry.createdAt ?? "—"}</td>
              <td className="break-words py-3 text-[#625E6B]">{entry.error ?? entry.failureReason ?? "—"}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      <div className="mt-3 flex items-center justify-between">
        <button disabled={!history.length || loading} onClick={previousPage} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">Previous</button>
        <button disabled={!nextCursor || loading} onClick={nextPage} className="rounded-lg bg-[#B91C1C] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Next</button>
      </div>
    </section>
  )
}

function PanelBody({ stats, campaignId }: { stats: CampaignStats; campaignId: string }) {
  const { counts, rates, alerts, thresholds, statusHistory } = stats
  const countItems: Array<[string, number]> = [
    ["Sent", counts.sent],
    ["Delivered", counts.delivered],
    ["Bounced", counts.bounced],
    ["Complained", counts.complained],
    ["Failed", counts.failed],
    ["Pending", counts.pending],
  ]

  return (
    <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <dl className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {countItems.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] text-[#625E6B]">{label}</dt>
              <dd className="mt-1 text-base font-semibold text-[#302D37]">{formatNumber(value)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5">
          <SendBreakdownBar counts={counts} showLegend />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] text-[#625E6B]">Delivery rate</p>
            <p className="mt-1 text-xs font-semibold text-[#302D37]">{formatRate(rates.delivery)}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-[#625E6B]">Bounce rate</p>
            <RateIndicator level={alerts.bounce} rate={rates.bounce} threshold={thresholds.bounce} />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-[#625E6B]">Complaint rate</p>
            <RateIndicator
              level={alerts.complaint}
              rate={rates.complaint}
              threshold={thresholds.complaint}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-[#302D37]">Status history</h3>
        <ol className="mt-3 space-y-3 border-l border-[#E3E1E7] pl-4">
          {statusHistory.map((entry, index) => (
            <li className="relative" key={`${entry.status}-${entry.changedAt}-${index}`}>
              <span className="absolute -left-[21px] top-1 flex size-3 items-center justify-center rounded-full border border-[#E3E1E7] bg-white text-[#625E6B]">
                <Icon name="clock" size={8} />
              </span>
              <div className="flex items-center gap-2">
                <StatusPill status={entry.status} />
                <span className="text-[11px] text-[#625E6B]">{formatDateTime(entry.changedAt)}</span>
              </div>
              <p className="mt-1 text-[11px] text-[#625E6B]">
                {entry.changedBy === null ? "By the system" : `By user ${entry.changedBy.slice(-8)}`}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11px] leading-4 text-[#625E6B]">
          Only user actions and the latest system change are recorded, so earlier automatic steps
          are not listed.
        </p>
      </div>
      <div className="lg:col-span-2">
        <CampaignDeliveryLogs campaignId={campaignId} />
      </div>
    </div>
  )
}
