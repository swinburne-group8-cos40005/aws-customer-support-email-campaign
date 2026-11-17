import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { type WorkspaceSettings } from "@/types"

export function SettingsPage({
  settings,
  onSave,
}: {
  settings: WorkspaceSettings
  onSave: (settings: WorkspaceSettings) => void
}) {
  const [draft, setDraft] = useState(settings)
  const [saved, setSaved] = useState(false)

  const update = <Key extends keyof WorkspaceSettings,>(
    key: Key,
    value: WorkspaceSettings[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  const notificationOptions: Array<{
    key: "campaignUpdates" | "weeklyDigest" | "audienceAlerts"
    title: string
    description: string
  }> = [
    {
      key: "campaignUpdates",
      title: "Campaign updates",
      description: "Delivery, completion, and performance notifications.",
    },
    {
      key: "weeklyDigest",
      title: "Weekly digest",
      description: "A concise summary of workspace activity every Monday.",
    },
    {
      key: "audienceAlerts",
      title: "Audience alerts",
      description: "Important changes to segments and subscriber health.",
    },
  ]

  return (
    <main className="mx-auto max-w-[1030px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#B91C1C]">
            Workspace
          </p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[#292631]">
            Settings
          </h1>
          <p className="mt-2 max-w-[580px] text-sm leading-6 text-[#625E6B]">
            Manage your account, sending defaults, and the notifications you
            receive from Postly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span
              aria-live="polite"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#247A4D]"
            >
              <Icon name="check" size={14} /> Changes saved
            </span>
          )}
          <Button
            onClick={() => {
              onSave(draft)
              setSaved(true)
            }}
          >
            Save changes
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-[#E3E1E7] bg-white p-6 sm:p-7">
            <div className="flex items-center gap-4 border-b border-[#ECEAEF] pb-6">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#FEE2E2] text-sm font-bold text-[#B91C1C]">
                TH
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#302D37]">
                  Personal details
                </h2>
                <p className="mt-1 text-xs text-[#625E6B]">
                  Used for account communication and attribution.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#403D48]">
                  Full name
                </span>
                <input
                  className="field"
                  onChange={(event) => update("fullName", event.target.value)}
                  value={draft.fullName}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#403D48]">
                  Email address
                </span>
                <input
                  className="field"
                  onChange={(event) => update("email", event.target.value)}
                  type="email"
                  value={draft.email}
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E3E1E7] bg-white p-6 sm:p-7">
            <div>
              <h2 className="text-base font-semibold text-[#302D37]">
                Workspace defaults
              </h2>
              <p className="mt-1 text-xs text-[#625E6B]">
                These details are prefilled when your team creates a campaign.
              </p>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#403D48]">
                  Workspace name
                </span>
                <input
                  className="field"
                  onChange={(event) =>
                    update("workspaceName", event.target.value)
                  }
                  value={draft.workspaceName}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#403D48]">
                  Timezone
                </span>
                <select
                  className="field"
                  onChange={(event) => update("timezone", event.target.value)}
                  value={draft.timezone}
                >
                  <option value="America/New_York">Eastern Time (UTC−5)</option>
                  <option value="America/Chicago">Central Time (UTC−6)</option>
                  <option value="America/Los_Angeles">
                    Pacific Time (UTC−8)
                  </option>
                  <option value="Europe/London">London (UTC+0)</option>
                  <option value="Asia/Ho_Chi_Minh">
                    Ho Chi Minh City (UTC+7)
                  </option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#403D48]">
                  Default sender name
                </span>
                <input
                  className="field"
                  onChange={(event) => update("senderName", event.target.value)}
                  value={draft.senderName}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#403D48]">
                  Reply-to email
                </span>
                <input
                  className="field"
                  onChange={(event) => update("replyTo", event.target.value)}
                  type="email"
                  value={draft.replyTo}
                />
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-[#E3E1E7] bg-white p-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#B91C1C]">
              <Icon name="mail" size={18} />
            </div>
            <h2 className="mt-4 text-base font-semibold text-[#302D37]">
              Notifications
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#625E6B]">
              Choose which account emails you receive.
            </p>
            <div className="mt-5 divide-y divide-[#ECEAEF]">
              {notificationOptions.map((option) => {
                const enabled = draft[option.key]
                return (
                  <div
                    className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    key={option.key}
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#3D3945]">
                        {option.title}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-[#625E6B]">
                        {option.description}
                      </p>
                    </div>
                    <button
                      aria-checked={enabled}
                      aria-label={`${option.title}: ${enabled ? "on" : "off"}`}
                      className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C] ${
                        enabled ? "bg-[#B91C1C]" : "bg-[#8A8492]"
                      }`}
                      onClick={() => update(option.key, !enabled)}
                      role="switch"
                      type="button"
                    >
                      <span
                        className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition ${
                          enabled ? "left-[18px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E3E1E7] bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#F0EFF2] text-[#494552]">
                <Icon name="settings" size={18} />
              </div>
              <span className="rounded-full bg-[#DEF5E7] px-2.5 py-1 text-[10px] font-bold text-[#247A4D]">
                SECURE
              </span>
            </div>
            <h2 className="mt-4 text-base font-semibold text-[#302D37]">
              Account security
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#625E6B]">
              Your password was last changed 18 days ago. Two-factor
              authentication is enabled.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
