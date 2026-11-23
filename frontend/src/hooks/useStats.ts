import { useCallback } from "react"
import { fetchCampaignStats, fetchStatsOverview } from "@/api/stats"
import { useApiResource } from "@/hooks/useApiResource"

/** Dashboard home data: totals, rates, alerts and the newest campaigns. */
export function useStatsOverview(limit = 10) {
  const load = useCallback((signal: AbortSignal) => fetchStatsOverview(limit, signal), [limit])
  return useApiResource(load)
}

/** One campaign's counters, rates and status history; idle while no campaign is selected. */
export function useCampaignStats(campaignId: string | null) {
  const load = useCallback(
    (signal: AbortSignal) => fetchCampaignStats(campaignId ?? "", signal),
    [campaignId],
  )
  return useApiResource(load, campaignId !== null)
}
