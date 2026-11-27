import { useEffect, useState } from "react"
import { AudienceStep } from "@/components/campaign/AudienceStep"
import { CampaignFooter } from "@/components/campaign/CampaignFooter"
import { CampaignHeader } from "@/components/campaign/CampaignHeader"
import { ReviewStep } from "@/components/campaign/ReviewStep"
import { SentConfirmation } from "@/components/campaign/SentConfirmation"
import { SetupStep } from "@/components/campaign/SetupStep"
import { Stepper } from "@/components/campaign/Stepper"
import { TemplateStep } from "@/components/campaign/TemplateStep"
import { REVIEW_STEP } from "@/data/campaignSteps"
import { type CampaignDraft } from "@/hooks/useCampaignDraft"

function getTemplateBody(bodyText: string | null, bodyHtml: string | null) {
  if (bodyText !== null) return bodyText
  if (bodyHtml === null) return ""
  return (
    new DOMParser().parseFromString(bodyHtml, "text/html").body.textContent ??
    ""
  )
}

export function CampaignPage({
  draft,
  darkMode,
  onOpenSettings,
  onToggleTheme,
}: {
  draft: CampaignDraft
  darkMode: boolean
  onOpenSettings: () => void
  onToggleTheme: () => void
}) {
  const [step, setStep] = useState(0)
  const [sendMode, setSendMode] = useState<"now" | "later">("now")
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")

  const selectedTemplate = draft.templates.find(
    (template) => template.templateId === draft.templateId,
  )
  const reviewTemplate = selectedTemplate
    ? {
        ...selectedTemplate,
        subjectTemplate: subject,
        bodyHtml: null,
        bodyText: body,
      }
    : undefined
  const recipients = draft.preview?.netAudience ?? 0

  useEffect(() => {
    setSubject(selectedTemplate?.subjectTemplate ?? "")
    setBody(
      selectedTemplate
        ? getTemplateBody(selectedTemplate.bodyText, selectedTemplate.bodyHtml)
        : "",
    )
  }, [selectedTemplate])

  async function continueWizard() {
    if (step + 1 === REVIEW_STEP) {
      const saved = await draft.saveDraft()
      if (!saved) return
    }
    setStep((current) => current + 1)
  }

  async function submitCampaign() {
    const result =
      sendMode === "later"
        ? await draft.schedule(scheduleDate, scheduleTime)
        : await draft.sendNow()

    if (result) setSubmitted(true)
  }

  if (submitted && draft.campaign) {
    return (
      <SentConfirmation
        campaign={draft.campaign}
        campaignName={draft.campaignName}
        darkMode={darkMode}
        onCancel={draft.cancelScheduled}
        onCreateAnother={() => {
          setSubmitted(false)
          setStep(0)
        }}
        onToggleTheme={onToggleTheme}
        recipients={recipients}
      />
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <CampaignHeader
        darkMode={darkMode}
        onOpenSettings={onOpenSettings}
        onToggleTheme={onToggleTheme}
      />
      <Stepper setStep={setStep} step={step} />

      <main className="mx-auto w-full max-w-[1114px] flex-1 px-5 py-8 sm:px-8 sm:py-10">
        {draft.loadError && (
          <p
            className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {draft.loadError}
          </p>
        )}
        {draft.error && (
          <p
            className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {draft.error}
          </p>
        )}

        {step === 0 && (
          <TemplateStep
            templates={draft.templates}
            selected={draft.templateId}
            setSelected={draft.setTemplateId}
          />
        )}
        {step === 1 && (
          <SetupStep
            name={draft.campaignName}
            setName={draft.setCampaignName}
            subject={subject}
            setSubject={setSubject}
            body={body}
            setBody={setBody}
          />
        )}
        {step === 2 && (
          <AudienceStep
            segments={draft.segments}
            selected={draft.segmentId}
            preview={draft.preview}
            onSelect={draft.setSegmentId}
          />
        )}
        {step === REVIEW_STEP && (
          <ReviewStep
            campaignName={draft.campaignName}
            template={reviewTemplate}
            recipients={recipients}
            sendMode={sendMode}
            setSendMode={setSendMode}
            scheduleDate={scheduleDate}
            setScheduleDate={setScheduleDate}
            scheduleTime={scheduleTime}
            setScheduleTime={setScheduleTime}
          />
        )}
      </main>

      <CampaignFooter
        busy={draft.busy}
        step={step}
        sendMode={sendMode}
        onBack={() => setStep((current) => Math.max(0, current - 1))}
        onNext={continueWizard}
        onSend={submitCampaign}
      />
    </div>
  )
}
