import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { type Campaign } from "@/lib/api"

export function SentConfirmation({
  campaign,
  campaignName,
  recipients,
  darkMode,
  onToggleTheme,
  onCancel,
  onCreateAnother,
}: {
  campaign: Campaign
  campaignName: string
  recipients: number
  darkMode: boolean
  onToggleTheme: () => void
  onCancel: () => Promise<Campaign | null>
  onCreateAnother: () => void
}) {
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState("")

  async function cancelCampaign() {
    setCancelling(true)
    setError("")
    const result = await onCancel()
    if (!result) setError("Could not cancel this campaign.")
    setCancelling(false)
  }

  const statusText: Record<Campaign["status"], string> = {
    draft: "Draft",
    scheduled: "Your campaign is scheduled",
    sending: "Your campaign is being sent",
    completed: "Your campaign has been sent",
    failed: "Campaign sending failed",
    cancelled: "Your campaign was cancelled",
  }

  return (
    <>
      <div className="absolute right-6 top-5 z-20">
        <ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} />
      </div>
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-[520px] text-center">
          <h1 className="text-[30px] font-semibold text-[#292631]">
            {statusText[campaign.status]}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#625E6B]">
            “{campaignName}” — status: <strong>{campaign.status}</strong>.
            Estimated recipients: {recipients.toLocaleString()}.
          </p>

          {error && (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <div className="mt-7 flex justify-center gap-3">
            {campaign.status === "scheduled" && (
              <Button
                disabled={cancelling}
                onClick={() => void cancelCampaign()}
              >
                {cancelling ? "Cancelling…" : "Cancel schedule"}
              </Button>
            )}
            <Button variant="secondary" onClick={onCreateAnother}>
              Create another
            </Button>
          </div>
        </div>
      </main>
    </>
  )
}