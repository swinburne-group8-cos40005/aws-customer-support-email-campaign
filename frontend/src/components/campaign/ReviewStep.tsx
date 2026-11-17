import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { templates } from "@/data/templates"
import { type SendMode } from "@/types"

export function ReviewStep({
  campaignName,
  subject,
  templateId,
  recipients,
  sendMode,
  setSendMode,
  scheduleDate,
  setScheduleDate,
  scheduleTime,
  setScheduleTime,
}: {
  campaignName: string
  subject: string
  templateId: number
  recipients: number
  sendMode: SendMode
  setSendMode: (mode: SendMode) => void
  scheduleDate: string
  setScheduleDate: (date: string) => void
  scheduleTime: string
  setScheduleTime: (time: string) => void
}) {
  const template =
    templates.find((item) => item.id === templateId) ?? templates[1]
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-4">
        <div className="rounded-2xl border border-[#E3E1E7] bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#625E6B]">
                Campaign
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#2C2934]">
                {campaignName}
              </h2>
              <p className="mt-1.5 text-sm text-[#777380]">{subject}</p>
            </div>
            <Button variant="secondary">
              <Icon name="edit" size={15} /> Edit
            </Button>
          </div>
          <div className="mt-6 grid gap-3 border-t border-[#ECEAEF] pt-5 sm:grid-cols-3">
            {[
              ["From", "Trong Hieu"],
              ["Reply to", "hello@postly.com"],
              ["Recipients", recipients.toLocaleString()],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] text-[#625E6B]">{label}</p>
                <p className="mt-1 text-xs font-semibold text-[#494552]">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E3E1E7] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[#3D3945]">
                Email preview
              </p>
              <p className="mt-1 text-xs text-[#625E6B]">
                This is how your email will appear on desktop.
              </p>
            </div>
            <Button variant="secondary">
              <Icon name="eye" size={15} /> Preview
            </Button>
          </div>
          <div className={`mt-5 rounded-xl ${template.color} p-5 sm:p-8`}>
            <div className="mx-auto max-w-[430px] overflow-hidden rounded-md bg-white shadow-[0_14px_35px_rgba(41,36,56,.13)]">
              <div className="p-7">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#DC2626]">
                  POSTLY NOTES
                </p>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[#26232D]">
                  A brighter way to grow
                </h3>
                <p className="mt-3 text-xs leading-5 text-[#625E6B]">
                  Meet the tools we’ve been building to help your best ideas
                  reach more people.
                </p>
                <div
                  className={`mt-6 h-32 rounded-md ${template.accent} opacity-90`}
                />
                <div className="mt-6 inline-flex rounded-md bg-[#27242D] px-4 py-2 text-[10px] font-semibold text-white">
                  Explore what’s new
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <aside className="h-fit space-y-4">
        <div className="rounded-2xl border border-[#E3E1E7] bg-white p-5">
          <p className="text-[13px] font-semibold text-[#3D3945]">
            Pre-send checklist
          </p>
          <div className="mt-4 space-y-3.5">
            {[
              "Campaign details complete",
              "Email content ready",
              "Audience selected",
              "Tracking enabled",
            ].map((label) => (
              <div
                className="flex items-center gap-2.5 text-xs text-[#666270]"
                key={label}
              >
                <span className="flex size-5 items-center justify-center rounded-full bg-[#DEF5E7] text-[#247A4D]">
                  <Icon name="check" size={12} />
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E3E1E7] bg-white p-5">
          <p className="text-[13px] font-semibold text-[#3D3945]">
            Send options
          </p>
          <label
            className={`mt-4 flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
              sendMode === "now"
                ? "border-[#B91C1C] bg-[#FEF2F2]"
                : "border-[#D6D2DC]"
            }`}
          >
            <input
              checked={sendMode === "now"}
              className="accent-[#B91C1C]"
              name="schedule"
              onChange={() => setSendMode("now")}
              type="radio"
            />
            <span>
              <span className="block text-xs font-semibold text-[#46414F]">
                Send now
              </span>
              <span className="text-[11px] text-[#625E6B]">
                Deliver immediately
              </span>
            </span>
          </label>
          <label
            className={`mt-2 flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
              sendMode === "later"
                ? "border-[#B91C1C] bg-[#FEF2F2]"
                : "border-[#D6D2DC]"
            }`}
          >
            <input
              checked={sendMode === "later"}
              className="accent-[#B91C1C]"
              name="schedule"
              onChange={() => setSendMode("later")}
              type="radio"
            />
            <span>
              <span className="block text-xs font-semibold text-[#46414F]">
                Schedule for later
              </span>
              <span className="text-[11px] text-[#625E6B]">
                Choose a date and time
              </span>
            </span>
          </label>
          {sendMode === "later" && (
            <div className="mt-3 rounded-xl border border-[#D6D2DC] bg-[#FAF9FB] p-3">
              <p className="text-xs font-semibold text-[#3D3945]">
                Delivery date and time
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label>
                  <span className="mb-1.5 block text-[11px] font-medium text-[#625E6B]">
                    Date
                  </span>
                  <input
                    className="field"
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setScheduleDate(event.target.value)}
                    required
                    type="date"
                    value={scheduleDate}
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-[11px] font-medium text-[#625E6B]">
                    Time
                  </span>
                  <input
                    className="field"
                    onChange={(event) => setScheduleTime(event.target.value)}
                    required
                    type="time"
                    value={scheduleTime}
                  />
                </label>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-[#625E6B]">
                Uses your account timezone.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
