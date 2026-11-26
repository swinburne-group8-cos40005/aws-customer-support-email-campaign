import { apiGet } from "@/lib/api"

export type AuditLog = {
  audit_log_id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  changes: {
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
  }
  created_at: string
}

export type AuditLogFilters = {
  entityType?: string
  entityId?: string
  userId?: string
  cursor?: string
  limit?: number
}

export type AuditLogResponse = {
  data: AuditLog[]
  nextCursor: string | null
}

export function getAuditLogs(
  filters: AuditLogFilters = {},
  signal?: AbortSignal,
): Promise<AuditLogResponse> {
  return apiGet<AuditLogResponse>("/v1/audit-logs", {
    query: {
      entityType: filters.entityType,
      entityId: filters.entityId,
      userId: filters.userId,
      cursor: filters.cursor,
      limit: filters.limit ?? 20,
    },
    signal,
  })
}
