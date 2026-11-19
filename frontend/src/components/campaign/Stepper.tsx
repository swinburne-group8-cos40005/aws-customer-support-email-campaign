import { Icon } from "@/components/ui/Icon"
import { campaignSteps } from "@/data/campaignSteps"

export function Stepper({
  step,
  setStep,
}: {
  step: number
  setStep: (step: number) => void
}) {
  return (
    <div className="border-b border-[#E7E5EB] bg-white px-5 sm:px-8">
      <div className="mx-auto flex max-w-[1050px] gap-0 overflow-x-auto">
        {campaignSteps.map((label, index) => (
          <button
            className={`relative flex min-w-fit flex-1 items-center gap-2.5 px-3 py-4 text-left text-xs font-semibold transition ${
              index === step
                ? "text-[#C81E1E]"
                : index < step
                  ? "text-[#4E4A58]"
                  : "text-[#625E6B]"
            }`}
            key={label}
            onClick={() => index <= step && setStep(index)}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
                index < step
                  ? "bg-[#DC2626] text-white"
                  : index === step
                    ? "bg-[#FECACA] text-[#C81E1E]"
                    : "bg-[#F0EFF2] text-[#625E6B]"
              }`}
            >
              {index < step ? <Icon name="check" size={13} /> : index + 1}
            </span>
            <span className="hidden sm:block">{label}</span>
            {index === step && (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#DC2626]" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
