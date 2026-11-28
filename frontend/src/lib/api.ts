import { getIdToken, refreshIdToken } from "@/lib/auth"
import { config } from "@/lib/config"

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// Backwards-compatible name for hooks already using this class.
export { ApiError as ApiRequestError }

type ErrorEnvelope = { error?: { code?: string; message?: string } }

type RequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean | null | undefined>
  retryDbUnavailable?: boolean
}

function apiUrl(path: string, query?: RequestOptions["query"]): string {
  const normalizedPath = path.startsWith("/v1/")
    ? path
    : `/v1${path.startsWith("/") ? path : `/${path}`}`
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value))
    }
  }
  const serialized = params.toString()
  return `${config.apiBaseUrl}${normalizedPath}${serialized ? `?${serialized}` : ""}`
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The request was aborted.", "AbortError"))
      return
    }
    const timer = window.setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer)
      reject(new DOMException("The request was aborted.", "AbortError"))
    }, { once: true })
  })
}

async function parseError(response: Response): Promise<ApiError> {
  const payload = await response.json().catch(() => ({})) as ErrorEnvelope
  const code = payload.error?.code ?? `HTTP_${response.status}`
  const message = payload.error?.message ??
    (response.status === 503 && code === "DB_UNAVAILABLE"
      ? "The database is waking up. Please try again in a moment."
      : response.status === 401
        ? "Your sign-in session is no longer valid."
        : `Request failed (${response.status}).`)
  return new ApiError(message, code, response.status)
}

async function send<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const { query, retryDbUnavailable = true, ...requestInit } = init
  const url = apiUrl(path, query)
  const headers = new Headers(requestInit.headers)
  headers.set("Accept", "application/json")
  if (requestInit.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  let token: string
  try {
    token = await getIdToken()
  } catch {
    throw new ApiError("Sign in is required. Please sign in again.", "AUTH_REQUIRED", 401)
  }

  const doFetch = (jwt: string) => fetch(url, {
    ...requestInit,
    headers: new Headers([...headers.entries(), ["Authorization", `Bearer ${jwt}`]]),
  })

  let response: Response
  try {
    response = await doFetch(token)
    if (response.status === 401) {
      try {
        token = await refreshIdToken(token)
      } catch {
        throw new ApiError(
          "Your session has expired. Please sign in again.",
          "AUTH_REQUIRED",
          401,
        )
      }
      response = await doFetch(token)
    }

    if (!response.ok) {
      const error = await parseError(response)
      if (
        retryDbUnavailable &&
        response.status === 503 &&
        error.code === "DB_UNAVAILABLE"
      ) {
        // Two bounded retries: 300ms then 800ms. Never retry writes on other
        // errors, and keep the same idempotency semantics as the original call.
        for (const delay of [300, 800]) {
          await wait(delay, requestInit.signal ?? undefined)
          response = await doFetch(token)
          if (response.ok) break
          const retryError = await parseError(response)
          if (response.status !== 503 || retryError.code !== "DB_UNAVAILABLE") {
            throw retryError
          }
        }
        if (!response.ok) {
          throw new ApiError(
            "The database is temporarily unavailable. Please wait a moment and retry.",
            "DB_UNAVAILABLE",
            503,
          )
        }
      } else {
        throw error
      }
    }
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause
    throw new ApiError(
      "Could not reach the API. Check your connection and retry.",
      "NETWORK_ERROR",
      0,
    )
  }

  if (response.status === 204) return undefined as T
  return await response.json() as T
}

export function apiRequest<T>(path: string, init: RequestOptions = {}): Promise<T> {
  return send<T>(path, init)
}

export function apiGet<T>(
  path: string,
  options: { query?: RequestOptions["query"]; signal?: AbortSignal } = {},
): Promise<T> {
  return send<T>(path, { method: "GET", ...options })
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return send<T>(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return send<T>(path, {
    method: "PUT",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

export function apiDelete<T>(path: string): Promise<T> {
  return send<T>(path, { method: "DELETE" })
}

export function getApiBaseUrl(): string {
  return config.apiBaseUrl
}


export type ApiTemplate = {
  templateId: string
  name: string
  subjectTemplate: string
  bodyHtml: string | null
  bodyText: string | null
}

export type ApiSegment = {
  segmentId: string
  name: string
  description: string | null
}

export type CreateSegmentBody = {
    name: string
    description?: string
    rules: Record<string, unknown>
}

export type SegmentPreview = {
  segmentId: string
  segmentName: string
  estimatedRecipients: number
  suppressedExcluded: number
  netAudience: number
  calculatedAt: string
}

export type CampaignStatus =
  | "draft" | "scheduled" | "sending" | "completed" | "failed" | "cancelled"

export type Campaign = {
  campaignId: string
  name: string
  templateId: string
  segmentId: string
  status: CampaignStatus
  scheduledAt: string | null
}

type CampaignDraftBody = {
  name: string
  templateId: string
  segmentId: string
}

export type TemplateInput = {
  name: string
  subjectTemplate: string
  bodyHtml?: string | null
  bodyText?: string | null
}

export type CustomerPreferences = {
  customerId?: string
  isOptedOut: boolean
  reason?: string | null
  updatedAt?: string
}

export type CampaignDeliveryLog = {
  id?: string
  logId?: string
  customerId?: string
  recipientId?: string
  email?: string
  recipientEmail?: string
  status: string
  createdAt?: string
  updatedAt?: string
  sentAt?: string
  error?: string | null
  failureReason?: string | null
}

export type CampaignDeliveryLogsResponse = {
  data: CampaignDeliveryLog[]
  nextCursor: string | null
}

export const campaignApi = {
  async templates(): Promise<ApiTemplate[]> {
    return (await apiGet<{ data: ApiTemplate[] }>("/templates")).data
  },
  createTemplate(body: TemplateInput): Promise<ApiTemplate> {
    return apiPost("/templates", body)
  },
  updateTemplate(id: string, body: TemplateInput): Promise<ApiTemplate> {
    return apiPut(`/templates/${encodeURIComponent(id)}`, body)
  },
  deleteTemplate(id: string): Promise<void> {
    return apiDelete(`/templates/${encodeURIComponent(id)}`)
  },
  async segments(): Promise<ApiSegment[]> {
    return (await apiGet<{ data: ApiSegment[] }>("/segments")).data
  },
  createSegment(body: { name: string; description?: string }): Promise<ApiSegment> {
    return apiPost("/segments", body)
  },
  previewSegment(segmentId: string): Promise<SegmentPreview> {
    return apiPost(`/segments/${encodeURIComponent(segmentId)}/preview`)
  },
  getCustomerPreferences(customerId: string): Promise<CustomerPreferences> {
    return apiGet(`/customers/${encodeURIComponent(customerId)}/preferences`)
  },
  updateCustomerPreferences(
    customerId: string,
    body: { isOptedOut: boolean; reason?: string },
  ): Promise<CustomerPreferences> {
    return apiPut(`/customers/${encodeURIComponent(customerId)}/preferences`, body)
  },
  createDraft(body: CampaignDraftBody): Promise<Campaign> {
    return apiPost("/campaigns", body)
  },
  updateDraft(id: string, body: CampaignDraftBody): Promise<Campaign> {
    return apiPut(`/campaigns/${encodeURIComponent(id)}`, body)
  },
  schedule(id: string, scheduledAt: string): Promise<Campaign> {
    return apiPost(`/campaigns/${encodeURIComponent(id)}/schedule`, { scheduledAt })
  },
  sendNow(id: string): Promise<Campaign> {
    return apiPost(`/campaigns/${encodeURIComponent(id)}/send`)
  },
  cancel(id: string): Promise<Campaign> {
    return apiPost(`/campaigns/${encodeURIComponent(id)}/cancel`)
  },
  async campaignDeliveryLogs(
    campaignId: string,
    cursor?: string,
    limit = 20,
  ): Promise<CampaignDeliveryLogsResponse> {
    return apiGet(`/campaigns/${encodeURIComponent(campaignId)}/logs`, {
      query: { cursor, limit },
    })
  },
}
