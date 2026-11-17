import { useMemo, useState } from "react"
import { initialSegments } from "@/data/segments"
import { type SendMode } from "@/types"
import { getTomorrowDate } from "@/utils/dates"

/**
 * Holds everything the campaign wizard (and the Templates / Audience pages
 * that feed into it) needs to share. Lives in the workspace so progress
 * survives navigating to another view and back.
 */
export function useCampaignDraft() {
  const [step, setStep] = useState(0)
  const [campaignName, setCampaignName] = useState("Lorem ipsum")
  const [subject, setSubject] = useState(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  )
  const [templateId, setTemplateId] = useState(2)
  const [segments, setSegments] = useState(initialSegments)
  const [segmentsSelected, setSegmentsSelected] = useState([1])
  const [sendMode, setSendMode] = useState<SendMode>("now")
  const [scheduleDate, setScheduleDate] = useState(getTomorrowDate)
  const [scheduleTime, setScheduleTime] = useState("09:00")
  const [sent, setSent] = useState(false)

  const recipients = useMemo(
    () =>
      segmentsSelected.reduce(
        (sum, id) =>
          sum +
          Number(
            segments
              .find((segment) => segment.id === id)
              ?.contacts.replace(",", "") ?? 0,
          ),
        0,
      ),
    [segments, segmentsSelected],
  )

  /** Adds a custom segment and returns its new id. */
  const addSegment = (name: string, description = "") => {
    const id = Math.max(...segments.map((segment) => segment.id)) + 1
    setSegments((current) => [
      ...current,
      {
        id,
        name,
        desc: description || "Custom audience segment",
        contacts: "0",
        growth: "New",
      },
    ])
    return id
  }

  return {
    step,
    setStep,
    campaignName,
    setCampaignName,
    subject,
    setSubject,
    templateId,
    setTemplateId,
    segments,
    addSegment,
    segmentsSelected,
    setSegmentsSelected,
    sendMode,
    setSendMode,
    scheduleDate,
    setScheduleDate,
    scheduleTime,
    setScheduleTime,
    sent,
    setSent,
    recipients,
  }
}

export type CampaignDraft = ReturnType<typeof useCampaignDraft>
