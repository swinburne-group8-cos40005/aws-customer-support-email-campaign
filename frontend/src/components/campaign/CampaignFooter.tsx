import { Icon } from "@/components/ui/Icon"
import { REVIEW_STEP } from "@/data/campaignSteps"
import { type SendMode } from "@/types"

export function CampaignFooter({
  step,
  sendMode,
  busy,
  onBack,
  onNext,
  onSend,
}: {
  step: number
  sendMode: SendMode
  busy: boolean
  onBack: () => void
  onNext: () => void
  onSend: () => void
}) {
  const isReview = step === REVIEW_STEP

  return (
    <footer className="sticky bottom-0 z-20 border-t border-[#E2E0E6] bg-white/95 px-5 py-3 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-[1050px] items-center justify-between">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-[13px] font-semibold text-[#6D6979] hover:bg-[#F3F1F8]"
          disabled={busy}
          onClick={onBack}
          type="button"
        >
          {step > 0 && <Icon name="arrow-left" size={16} />}
          {step > 0 ? "Back" : "Campaign"}
        </button>

        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[#DC2626] px-4 text-[13px] font-semibold text-white hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          onClick={isReview ? onSend : onNext}
          type="button"
        >
          {busy ? (
            "Working…"
          ) : isReview ? (
            <>
              {sendMode === "later" ? "Schedule campaign" : "Send campaign"}
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
        </button>
      </div>
    </footer>
  )
}