import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { type SendMode } from "@/types"

/** "Your campaign is on its way / scheduled" success screen. */
export function SentConfirmation({
  darkMode,
  onToggleTheme,
  sendMode,
  campaignName,
  recipients,
  scheduleDate,
  scheduleTime,
  onCreateAnother,
}: {
  darkMode: boolean
  onToggleTheme: () => void
  sendMode: SendMode
  campaignName: string
  recipients: number
  scheduleDate: string
  scheduleTime: string
  onCreateAnother: () => void
}) {
  return (
    <>
      <div className="absolute right-6 top-5 z-20">
        <ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} />
      </div>
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-[520px] text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#E3C6C6]">
            <svg
              aria-hidden="true"
              fill="none"
              height={28}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
              width={28}
            >
              <path d="m22 2-7 20-4-9-9-4ZM22 2 11 13" stroke="#A02D2D" />
            </svg>
          </div>
          <h1 className="mt-6 text-[30px] font-semibold tracking-[-0.04em] text-[#292631]">
            {sendMode === "later"
              ? "Your campaign is scheduled"
              : "Your campaign is on its way"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#625E6B]">
            {sendMode === "later" ? (
              <>
                “{campaignName}” will be delivered to{" "}
                {recipients.toLocaleString()} recipients on{" "}
                {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString(
                  [],
                  {
                    dateStyle: "medium",
                    timeStyle: "short",
                  },
                )}
                .
              </>
            ) : (
              <>
                “{campaignName}” is being delivered to{" "}
                {recipients.toLocaleString()} recipients. We’ll start
                collecting insights as soon as they engage.
              </>
            )}
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <Button variant="secondary" onClick={onCreateAnother}>
              Create another
            </Button>
            <Button>
              <Icon name="grid" size={15} /> View campaign report
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
