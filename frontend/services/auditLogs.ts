
export type AuditLog = {
  audit_log_id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  changes: {
    before?: Record<string, unknown> | null
    after?: Record<string, unknown> | null
    [key: string]: unknown
  } | null
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export async function getAuditLogs(
  filters: AuditLogFilters = {},
): Promise<AuditLogResponse> {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is not configured.")
  }

  const params = new URLSearchParams()

  if (filters.entityType) params.set("entityType", filters.entityType)
  if (filters.entityId) params.set("entityId", filters.entityId)
  if (filters.userId) params.set("userId", filters.userId)

  params.set("limit", String(filters.limit ?? 20))

  if (filters.cursor) {
    params.set("cursor", filters.cursor)
  }

  // Temporary token hook. Replace this with your Cognito access-token
  // retrieval once the real Cognito authentication is integrated.
  const accessToken = sessionStorage.getItem("accessToken")

  const response = await fetch(
    `${API_BASE_URL.replace(/\/$/, "")}/v1/audit-logs?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
      },
    },
  )

  if (!response.ok) {
    const message = await response.text()
    throw new Error(
      message || `Failed to load audit logs (${response.status}).`,
    )
  }

  const result = (await response.json()) as AuditLogResponse

  if (!Array.isArray(result.data)) {
    throw new Error("The audit log API returned an invalid response.")
  }

  return {
    data: result.data,
    nextCursor: result.nextCursor ?? null,
  }
}
