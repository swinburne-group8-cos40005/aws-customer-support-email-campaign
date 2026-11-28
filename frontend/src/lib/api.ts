import { getIdToken, refreshAccessToken } from "@/lib/auth"
import { config } from "@/lib/config"

export class ApiError extends Error {
    constructor(
        message: string,
        readonly code: string,
        readonly status: number,
    ) {
        super(message)
    }
}

type ErrorEnvelope = { error?: { code?: string; message?: string } }

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${config.apiBaseUrl}/v1${path}`
    const headers = new Headers(init.headers)
    if (init.body) headers.set("Content-Type", "application/json")

    let idToken: string | null
    try { 
        idToken = await getIdToken()
    } catch (cause) {
        throw new ApiError(
            cause instanceof Error ? cause.message : "Your session has expired. Sign in again.",
            "AUTH_REQUIRED",
            401,
        )
    }
    if (!idToken) throw new ApiError("Sign in is required.", "AUTH_REQUIRED", 401)

    const request = (token: string) =>
        fetch(url, {
            ...init,
            headers: new Headers([
                ...headers,
                ["Authorization", `Bearer ${token}`],
            ]),
        })

    let response = await request(idToken)

    if (response.status === 401) {
        try {
            await refreshAccessToken()
            idToken = await getIdToken()
        } catch (cause) {
            throw new ApiError(
                cause instanceof Error ? cause.message : "Your session has expired. Sign in again.",
                "AUTH_REQUIRED",
                401,
            )
        }
        if (idToken) response = await request(idToken)
    }

    const text = await response.text()
    let payload: unknown
    try {
        payload = text ? JSON.parse(text) : undefined
    } catch {
        payload = undefined
    }

    if (response.status === 401) {
        throw new ApiError("Sign in is required.", "AUTH_REQUIRED", 401)
    }

    if (!response.ok) {
        const envelope = payload as ErrorEnvelope | undefined
        throw new ApiError(
            envelope?.error?.message ?? `Request failed (${response.status}).`,
            envelope?.error?.code ?? "HTTP_ERROR",
            response.status,
        )
    }

    return payload as T
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
    | "draft"
    | "scheduled"
    | "sending"
    | "completed"
    | "failed"
    | "cancelled"

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

export const campaignApi = {
    async templates(): Promise<ApiTemplate[]> {
        return (await send<{ data: ApiTemplate[] }>("/templates")).data
    },

    async segments(): Promise<ApiSegment[]> {
        return (await send<{ data: ApiSegment[] }>("/segments")).data
    },

    createSegment(body: CreateSegmentBody): Promise<ApiSegment> {
        return send("/segments", { method: "POST", body: JSON.stringify(body) })
    },

    previewSegment(segmentId: string): Promise<SegmentPreview> {
        return send(`/segments/${encodeURIComponent(segmentId)}/preview`, {
            method: "POST",
        })
    },

    createDraft(body: CampaignDraftBody): Promise<Campaign> {
        return send("/campaigns", { method: "POST", body: JSON.stringify(body) })
    },

    updateDraft(id: string, body: CampaignDraftBody): Promise<Campaign> {
        return send(`/campaigns/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(body),
        })
    },

    schedule(id: string, scheduledAt: string): Promise<Campaign> {
        return send(`/campaigns/${encodeURIComponent(id)}/schedule`, {
            method: "POST",
            body: JSON.stringify({ scheduledAt }),
        })
    },

    sendNow(id: string): Promise<Campaign> {
        return send(`/campaigns/${encodeURIComponent(id)}/send`, { method: "POST" })
    },

    cancel(id: string): Promise<Campaign> {
        return send(`/campaigns/${encodeURIComponent(id)}/cancel`, {
            method: "POST",
        })
    },
}
