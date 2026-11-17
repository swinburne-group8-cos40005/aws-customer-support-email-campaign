import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { type Segment } from "@/types"

export function AudienceStep({
  segments,
  selected,
  setSelected,
  onCreateSegment,
}: {
  segments: Segment[]
  selected: number[]
  setSelected: (ids: number[]) => void
  onCreateSegment: (name: string, description: string) => void
}) {
  const [showSegmentPrompt, setShowSegmentPrompt] = useState(false)
  const [segmentName, setSegmentName] = useState("")
  const [segmentDescription, setSegmentDescription] = useState("")
  const total = selected.reduce(
    (sum, id) =>
      sum +
      Number(
        segments
          .find((segment) => segment.id === id)
          ?.contacts.replace(",", "") ?? 0,
      ),
    0,
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-[#282631]">
            Who should receive this?
          </h2>
          <p className="mt-1 text-sm text-[#625E6B]">
            Select one or more customer segments for this campaign.
          </p>
        </div>
        <div className="mt-6 space-y-3">
          {segments.map((segment) => {
            const checked = selected.includes(segment.id)
            return (
              <button
                className={`flex w-full items-center gap-4 rounded-xl border bg-white p-4 text-left transition sm:p-5 ${
                  checked
                    ? "border-[#EF4444] ring-2 ring-[#EF4444]/10"
                    : "border-[#E3E1E7] hover:border-[#C8C4D0]"
                }`}
                key={segment.id}
                onClick={() =>
                  setSelected(
                    checked
                      ? selected.filter((id) => id !== segment.id)
                      : [...selected, segment.id],
                  )
                }
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${
                    checked
                      ? "border-[#DC2626] bg-[#DC2626] text-white"
                      : "border-[#CCC8D2] bg-white"
                  }`}
                >
                  {checked && <Icon name="check" size={13} />}
                </span>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#FEE2E2] text-[#DC2626]">
                  <Icon name="users" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[#373440]">
                    {segment.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[#625E6B]">
                    {segment.desc}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold text-[#373440]">
                    {segment.contacts}
                  </span>
                  <span
                    className={`text-[11px] ${
                      segment.growth.startsWith("+")
                        ? "text-[#247A4D]"
                        : segment.growth.startsWith("-")
                          ? "text-[#A3443C]"
                          : "text-[#625E6B]"
                    }`}
                  >
                    {segment.growth} this month
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <button
          aria-expanded={showSegmentPrompt}
          className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#B91C1C] hover:text-[#991B1B]"
          onClick={() => setShowSegmentPrompt((visible) => !visible)}
          type="button"
        >
          <Icon name="plus" size={15} /> Create a new segment
        </button>
        {showSegmentPrompt && (
          <form
            className="mt-4 rounded-2xl border border-[#D6D2DC] bg-white p-5 shadow-[0_12px_30px_rgba(39,35,54,.07)]"
            onSubmit={(event) => {
              event.preventDefault()
              const name = segmentName.trim()
              if (!name) return
              onCreateSegment(name, segmentDescription.trim())
              setSegmentName("")
              setSegmentDescription("")
              setShowSegmentPrompt(false)
            }}
          >
            <div>
              <p className="text-sm font-semibold text-[#2F2C36]">
                Create a new segment
              </p>
              <p className="mt-1 text-xs leading-5 text-[#625E6B]">
                Name your segment now. You can configure its audience rules
                later.
              </p>
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-semibold text-[#403D48]">
                Segment name
              </span>
              <input
                autoFocus
                className="field"
                onChange={(event) => setSegmentName(event.target.value)}
                placeholder="e.g. Recent purchasers"
                required
                value={segmentName}
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-semibold text-[#403D48]">
                Description
              </span>
              <textarea
                className="field min-h-20 resize-none py-3"
                onChange={(event) => setSegmentDescription(event.target.value)}
                placeholder="Describe who belongs in this segment"
                value={segmentDescription}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowSegmentPrompt(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create segment</Button>
            </div>
          </form>
        )}
      </section>
      <aside className="h-fit rounded-2xl border border-[#E3E1E7] bg-white p-5">
        <p className="text-[13px] font-semibold text-[#403D48]">
          Audience summary
        </p>
        <div className="mt-5 rounded-xl bg-[#FFF7F7] p-4">
          <div className="flex items-center gap-2 text-[#DC2626]">
            <Icon name="audience" size={18} />
            <span className="text-xs font-semibold">Estimated recipients</span>
          </div>
          <p className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[#432C2C]">
            {total.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-[#986B6B]">
            Across {selected.length} selected segments
          </p>
        </div>
        <div className="mt-5 space-y-3 border-t border-[#ECEAEF] pt-5 text-xs">
          <div className="flex justify-between text-[#625E6B]">
            <span>Active subscribers</span>
            <span className="font-semibold text-[#494552]">
              {total.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-[#625E6B]">
            <span>Suppressed</span>
            <span className="font-semibold text-[#494552]">184</span>
          </div>
          <div className="flex justify-between text-[#625E6B]">
            <span>Duplicates removed</span>
            <span className="font-semibold text-[#494552]">32</span>
          </div>
        </div>
      </aside>
    </div>
  )
}
