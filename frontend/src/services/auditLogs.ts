import { getIdToken } from "@/services/auth";

export type AuditLog = {
  audit_log_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: {
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  };
  created_at: string;
};

export type AuditLogFilters = {
  entityType?: string;
  entityId?: string;
  userId?: string;
  cursor?: string;
  limit?: number;
};

export type AuditLogResponse = {
  data: AuditLog[];
  nextCursor: string | null;
};

// Keep true until Cognito authentication is available.
export const USE_MOCK_AUDIT_LOGS = true;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const mockAuditLogs: AuditLog[] = [
  {
    audit_log_id: "audit-001",
    user_id: "user-demo-001",
    action: "campaign_created",
    entity_type: "campaign",
    entity_id: "campaign-001",
    changes: {
      before: null,
      after: {
        name: "November Product Update",
        status: "draft",
        subject: "Discover our latest updates"
      }
    },
    created_at: "2026-11-21T09:30:00Z"
  },
  {
    audit_log_id: "audit-002",
    user_id: "user-demo-001",
    action: "campaign_updated",
    entity_type: "campaign",
    entity_id: "campaign-001",
    changes: {
      before: {
        status: "draft",
        subject: "Discover our latest updates"
      },
      after: {
        status: "scheduled",
        subject: "November product announcements"
      }
    },
    created_at: "2026-11-21T10:15:00Z"
  },
  {
    audit_log_id: "audit-003",
    user_id: "user-demo-002",
    action: "template_created",
    entity_type: "template",
    entity_id: "template-001",
    changes: {
      before: null,
      after: {
        name: "Welcome Email",
        subject: "Welcome to our platform"
      }
    },
    created_at: "2026-11-20T08:20:00Z"
  },
  {
    audit_log_id: "audit-004",
    user_id: "user-demo-001",
    action: "template_updated",
    entity_type: "template",
    entity_id: "template-001",
    changes: {
      before: {
        subject: "Welcome to our platform"
      },
      after: {
        subject: "Welcome! Here's how to get started"
      }
    },
    created_at: "2026-11-20T09:45:00Z"
  },
  {
    audit_log_id: "audit-005",
    user_id: "user-demo-003",
    action: "opt_out",
    entity_type: "customer_preference",
    entity_id: "customer-001",
    changes: {
      before: { isOptedOut: false },
      after: {
        isOptedOut: true,
        reason: "customer_requested"
      }
    },
    created_at: "2026-11-19T11:00:00Z"
  },
  {
    audit_log_id: "audit-006",
    user_id: "user-demo-003",
    action: "opt_in",
    entity_type: "customer_preference",
    entity_id: "customer-001",
    changes: {
      before: { isOptedOut: true },
      after: { isOptedOut: false }
    },
    created_at: "2026-11-19T12:30:00Z"
  }
];

async function getMockAuditLogs(
  filters: AuditLogFilters
): Promise<AuditLogResponse> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  let results = [...mockAuditLogs];

  if (filters.entityType) {
    results = results.filter(
      (log) => log.entity_type === filters.entityType
    );
  }

  if (filters.entityId?.trim()) {
    results = results.filter(
      (log) =>
        log.entity_id.toLowerCase() ===
        filters.entityId!.trim().toLowerCase()
    );
  }

  if (filters.userId?.trim()) {
    results = results.filter(
      (log) =>
        log.user_id.toLowerCase() ===
        filters.userId!.trim().toLowerCase()
    );
  }

  results.sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );

  const limit = filters.limit ?? 2;
  const offset = filters.cursor
    ? Math.max(0, Number.parseInt(filters.cursor, 10) || 0)
    : 0;

  return {
    data: results.slice(offset, offset + limit),
    nextCursor:
      offset + limit < results.length
        ? String(offset + limit)
        : null
  };
}

async function getRealAuditLogs(
  filters: AuditLogFilters
): Promise<AuditLogResponse> {
  if (!API_BASE_URL) {
    throw new Error("API_BASE_URL is not configured.");
  }

  const token = await getIdToken();

  if (!token) {
    throw new Error(
      "Authentication unavailable. Please sign in before using the real API."
    );
  }

  const params = new URLSearchParams();

  if (filters.entityType) {
    params.set("entityType", filters.entityType);
  }

  if (filters.entityId) {
    params.set("entityId", filters.entityId);
  }

  if (filters.userId) {
    params.set("userId", filters.userId);
  }

  if (filters.cursor) {
    params.set("cursor", filters.cursor);
  }

  params.set("limit", String(filters.limit ?? 2));

  const response = await fetch(
    `${API_BASE_URL}/v1/audit-logs?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );

  if (response.status === 401) {
    throw new Error(
      "Your authentication session is invalid or expired. Please sign in again."
    );
  }

  if (response.status === 403) {
    throw new Error(
      "You do not have permission to view audit logs."
    );
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load audit logs (${response.status}).`
    );
  }

  return response.json() as Promise<AuditLogResponse>;
}

export async function getAuditLogs(
  filters: AuditLogFilters = {}
): Promise<AuditLogResponse> {
  if (USE_MOCK_AUDIT_LOGS) {
    return getMockAuditLogs(filters);
  }

  return getRealAuditLogs(filters);
}
