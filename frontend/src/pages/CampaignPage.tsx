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

/**
 * The four-step "Create campaign" wizard, plus its post-send confirmation.
 * Rendered inside the workspace's AppShell, so it only supplies its own
 * header, stepper, content and footer.
 */
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
  const {
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
  } = draft

  if (sent) {
    return (
      <SentConfirmation
        campaignName={campaignName}
        darkMode={darkMode}
        onCreateAnother={() => {
          setStep(0)
          setSent(false)
        }}
        onToggleTheme={onToggleTheme}
        recipients={recipients}
        scheduleDate={scheduleDate}
        scheduleTime={scheduleTime}
        sendMode={sendMode}
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
        {step === 0 && (
          <TemplateStep selected={templateId} setSelected={setTemplateId} />
        )}
        {step === 1 && (
          <SetupStep
            name={campaignName}
            setName={setCampaignName}
            setSubject={setSubject}
            subject={subject}
          />
        )}
        {step === 2 && (
          <AudienceStep
            onCreateSegment={(name, description) => {
              const id = addSegment(name, description)
              setSegmentsSelected((current) => [...current, id])
            }}
            segments={segments}
            selected={segmentsSelected}
            setSelected={setSegmentsSelected}
          />
        )}
        {step === REVIEW_STEP && (
          <ReviewStep
            campaignName={campaignName}
            recipients={recipients}
            scheduleDate={scheduleDate}
            scheduleTime={scheduleTime}
            sendMode={sendMode}
            setScheduleDate={setScheduleDate}
            setScheduleTime={setScheduleTime}
            setSendMode={setSendMode}
            subject={subject}
            templateId={templateId}
          />
        )}
      </main>
      <CampaignFooter
        onBack={() => setStep(step - 1)}
        onNext={() => setStep(step + 1)}
        onSend={() => setSent(true)}
        sendMode={sendMode}
        step={step}
      />
    </div>
  )
}
