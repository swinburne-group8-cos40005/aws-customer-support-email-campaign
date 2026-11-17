import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { REVIEW_STEP } from "@/data/campaignSteps"
import { type SendMode } from "@/types"

/** Sticky Back / Continue / Send bar at the bottom of the campaign wizard. */
export function CampaignFooter({
  step,
  sendMode,
  onBack,
  onNext,
  onSend,
}: {
  step: number
  sendMode: SendMode
  onBack: () => void
  onNext: () => void
  onSend: () => void
}) {
  const isReview = step === REVIEW_STEP

  return (
    <footer className="sticky bottom-0 z-20 border-t border-[#E2E0E6] bg-white/95 px-5 py-3 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-[1050px] items-center justify-between">
        <Button variant="ghost" onClick={() => step > 0 && onBack()}>
          {step > 0 && <Icon name="arrow-left" size={16} />}
          {step > 0 ? "Back" : "Cancel"}
        </Button>
        <div className="flex items-center gap-3">
          {isReview && (
            <Button variant="secondary">
              <Icon name="clock" size={15} /> Send a test
            </Button>
          )}
          <Button onClick={() => (isReview ? onSend() : onNext())}>
            {isReview ? (
              <>
                {sendMode === "later" ? "Schedule campaign" : "Send campaign"}{" "}
                <Icon
                  name={sendMode === "later" ? "clock" : "paper-plane"}
                  size={15}
                />
              </>
            ) : (
              <>
                Continue <Icon name="arrow-right" size={16} />
              </>
            )}
          </Button>
        </div>
      </div>
    </footer>
  )
}
