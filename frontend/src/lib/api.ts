import { beginSignIn, getAccessToken, refreshAccessToken } from "@/lib/auth"
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

    let accessToken: string
    try { 
        accessToken = await getAccessToken()
    } catch {
        await beginSignIn()
        throw new ApiError("Redirecting to sign in.", "AUTH_REQUIRED", 401)
    }

    const request = (token: string) =>
        fetch(url, {
            ...init,
            headers: new Headers([
                ...headers,
                ["Authorization", `Bearer ${token}`],
            ]),
        })

    let response = await request(accessToken)

    if (response.status === 401) {
        try {
            accessToken = await refreshAccessToken()
        } catch {
            await beginSignIn()
            throw new ApiError("Your session expired. Redirecting to sign in.", "AUTH_REQUIRED", 401)
        }
        response = await request(accessToken)
    }

    const text = await response.text()
    let payload: unknown
    try {
        payload = text ? JSON.parse(text) : undefined
    } catch {
        payload = undefined
    }

    if (response.status === 401) {
        await beginSignIn()
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