import { apiGet } from "@/api/client"

/** Response shapes of docs/api-contract.md §2.6 (statistics & reporting). */

export type AlertLevel = "ok" | "warning" | "critical"

export type EmailCounts = {
  sent: number
  delivered: number
  bounced: number
  complained: number
  failed: number
  pending: number
}

/** Decimal fractions between 0 and 1; null when nothing was sent yet. */
export type EmailRates = {
  delivery: number | null
  bounce: number | null
  complaint: number | null
}

export type RateAlerts = { bounce: AlertLevel; complaint: AlertLevel }

export type RateThresholds = {
  bounce: { warning: number; critical: number }
  complaint: { warning: number; critical: number }
}

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "completed"
  | "failed"
  | "cancelled"

export type CampaignStatsSummary = {
  campaignId: string
  name: string
  status: CampaignStatus
  scheduledAt: string | null
  counts: EmailCounts
  rates: EmailRates
  alerts: RateAlerts
}

export type StatsOverview = {
  generatedAt: string
  totals: EmailCounts & { campaigns: number }
  rates: EmailRates
  alerts: RateAlerts
  campaignsByStatus: Record<CampaignStatus, number>
  thresholds: RateThresholds
  recentCampaigns: CampaignStatsSummary[]
}

export type StatusHistoryEntry = {
  status: CampaignStatus
  changedAt: string
  /** Cognito sub of the person, or null when the system (dispatcher) changed it. */
  changedBy: string | null
}

export type CampaignStats = {
  campaignId: string
  name: string
  status: CampaignStatus
  generatedAt: string
  counts: EmailCounts
  rates: EmailRates
  alerts: RateAlerts
  thresholds: RateThresholds
  statusHistory: StatusHistoryEntry[]
}

export function fetchStatsOverview(limit: number, signal?: AbortSignal) {
  return apiGet<StatsOverview>("/v1/stats/overview", { query: { limit }, signal })
}

export function fetchCampaignStats(campaignId: string, signal?: AbortSignal) {
  return apiGet<CampaignStats>(`/v1/campaigns/${encodeURIComponent(campaignId)}/stats`, { signal })
}
