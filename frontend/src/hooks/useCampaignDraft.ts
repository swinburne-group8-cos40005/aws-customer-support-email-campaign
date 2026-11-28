import { useEffect, useState } from "react"
import { localDateTimeToUtcIso } from "@/utils/dates"
import {
  campaignApi,
  type ApiSegment,
  type ApiTemplate,
  type Campaign,
  type CreateSegmentBody,
  type SegmentPreview,
} from "@/lib/api"

export function useCampaignDraft() {
  const [templates, setTemplates] = useState<ApiTemplate[]>([])
  const [segments, setSegments] = useState<ApiSegment[]>([])
  const [templateId, setTemplateId] = useState("")
  const [segmentId, setSegmentId] = useState("")
  const [campaignName, setCampaignName] = useState("")
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [preview, setPreview] = useState<SegmentPreview | null>(null)
  const [loadError, setLoadError] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function createSegment(body: CreateSegmentBody): Promise<ApiSegment> {
    const segment = await campaignApi.createSegment(body)
    setSegments((current) => [segment, ...current])
    return segment
  }

  useEffect(() => {
    let active = true
    Promise.all([campaignApi.templates(), campaignApi.segments()])
      .then(([loadedTemplates, loadedSegments]) => {
        if (!active) return
        setTemplates(loadedTemplates)
        setSegments(loadedSegments)
        setTemplateId(loadedTemplates[0]?.templateId ?? "")
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(cause instanceof Error ? cause.message : "Could not load campaign data.")
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setPreview(null)
    if (!segmentId) return

    campaignApi.previewSegment(segmentId)
      .then((result) => {
        if (active) setPreview(result)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not preview this segment.")
      })

    return () => {
      active = false
    }
  }, [segmentId])

  const body = (): { name: string; templateId: string; segmentId: string } => {
    if (!campaignName.trim() || !templateId || !segmentId) {
      throw new Error("Campaign name, template, and audience are required.")
    }
    return { name: campaignName.trim(), templateId, segmentId }
  }

  async function persistDraft(): Promise<Campaign> {
    const payload = body()
    const saved = campaign 
      ? await campaignApi.updateDraft(campaign.campaignId, payload)
      : await campaignApi.createDraft(payload)
    setCampaign(saved)
    return saved
  }

  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    setBusy(true)
    setError("")
    try {
      return await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request failed.")
      return null
    } finally {
      setBusy(false)
    }
  }

  async function reloadTemplates() {
    const loaded = await campaignApi.templates()
    setTemplates(loaded)
  }

  async function reloadSegments() {
    const loaded = await campaignApi.segments()
    setSegments(loaded)
  }

  return {
    templates,
    reloadTemplates,
    reloadSegments,
    segments,
    createSegment,
    templateId,
    setTemplateId,
    segmentId,
    setSegmentId,
    campaignName,
    setCampaignName,
    campaign,
    preview,
    loadError,
    error,
    busy,

    // Call when entering review step: creates initial draft
    saveDraft: () => run(persistDraft),

    // Each operation updates the draft first, then performs the transition
    schedule: (date: string, time: string) =>
      run(async () => {
        const draft = await persistDraft()
        const scheduledAt = localDateTimeToUtcIso(date, time)
        const result = await campaignApi.schedule(draft.campaignId, scheduledAt)
        setCampaign(result)
        return result
      }),

    sendNow: () =>
      run(async () => {
        const draft = await persistDraft()
        const result = await campaignApi.sendNow(draft.campaignId)
        setCampaign(result)
        return result
      }),

    cancelScheduled: () =>
      campaign
        ? run(async () => {
          const result = await campaignApi.cancel(campaign.campaignId)
          setCampaign(result)
          return result
        })
        : Promise.resolve(null),
  }
}

export type CampaignDraft = ReturnType<typeof useCampaignDraft>
