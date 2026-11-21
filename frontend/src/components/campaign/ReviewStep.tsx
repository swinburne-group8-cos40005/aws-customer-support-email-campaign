import { type ApiTemplate } from "@/lib/api"
import { type SendMode } from "@/types"

export function ReviewStep({
  campaignName,
  template,
  recipients,
  sendMode,
  setSendMode,
  scheduleDate,
  setScheduleDate,
  scheduleTime,
  setScheduleTime,
}: {
  campaignName: string
  template: ApiTemplate | undefined
  recipients: number
  sendMode: SendMode
  setSendMode: (mode: SendMode) => void
  scheduleDate: string
  setScheduleDate: (date: string) => void
  scheduleTime: string
  setScheduleTime: (time: string) => void
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="rounded-2xl border border-[#E3E1E7] bg-white p-6">
        <p className="text-xs font-bold uppercase text-[#625E6B]">Campaign</p>
        <h2 className="mt-2 text-xl font-semibold text-[#2C2934]">
          {campaignName}
        </h2>
        <p className="mt-2 text-sm text-[#625E6B]">
          Template: {template?.name ?? "No template selected"}
        </p>
        <p className="mt-1 text-sm text-[#625E6B]">
          Subject: {template?.subjectTemplate ?? "No subject"}
        </p>
        <p className="mt-4 text-sm text-[#625E6B]">
          Estimated recipients: {recipients.toLocaleString()}
        </p>
      </section>

      <aside className="rounded-2xl border border-[#E3E1E7] bg-white p-5">
        <p className="text-[13px] font-semibold text-[#3D3945]">Send options</p>
        <label className="mt-4 flex items-center gap-3">
          <input
            checked={sendMode === "now"}
            name="schedule"
            onChange={() => setSendMode("now")}
            type="radio"
          />
          Send now
        </label>
        <label className="mt-3 flex items-center gap-3">
          <input
            checked={sendMode === "later"}
            name="schedule"
            onChange={() => setSendMode("later")}
            type="radio"
          />
          Schedule for later
        </label>

        {sendMode === "later" && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-xs text-[#625E6B]">
              Date
              <input
                className="field mt-1"
                onChange={(event) => setScheduleDate(event.target.value)}
                required
                type="date"
                value={scheduleDate}
              />
            </label>
            <label className="text-xs text-[#625E6B]">
              Time
              <input
                className="field mt-1"
                onChange={(event) => setScheduleTime(event.target.value)}
                required
                type="time"
                value={scheduleTime}
              />
            </label>
          </div>
        )}
      </aside>
    </div>
  )
}