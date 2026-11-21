import { Icon } from "@/components/ui/Icon"
import {
  type ApiSegment,
  type SegmentPreview,
} from "@/lib/api"

export function AudienceStep({
  segments,
  selected,
  preview,
  onSelect,
}: {
  segments: ApiSegment[]
  selected: string
  preview: SegmentPreview | null
  onSelect: (id: string) => void
}) {
  const currentPreview =
    preview?.segmentId === selected ? preview : null

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section>
        <h2 className="text-xl font-semibold text-[#282631]">
          Who should receive this?
        </h2>
        <p className="mt-1 text-sm text-[#625E6B]">
          Select an audience segment to preview its live recipient estimate.
        </p>

        <div className="mt-6 space-y-3">
          {segments.map((segment) => (
            <button
              className={`flex w-full items-center gap-4 rounded-xl border bg-white p-4 text-left ${
                selected === segment.segmentId
                  ? "border-[#EF4444] ring-2 ring-[#EF4444]/10"
                  : "border-[#E3E1E7]"
              }`}
              key={segment.segmentId}
              onClick={() => onSelect(segment.segmentId)}
              type="button"
            >
              <Icon name="users" size={18} />
              <span>
                <span className="block text-sm font-semibold text-[#373440]">
                  {segment.name}
                </span>
                <span className="mt-1 block text-xs text-[#625E6B]">
                  {segment.description || "No description"}
                </span>
              </span>
            </button>
          ))}
          {segments.length === 0 && (
            <p className="text-sm text-[#625E6B]">No segments are available.</p>
          )}
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-[#E3E1E7] bg-white p-5">
        <p className="text-[13px] font-semibold text-[#403D48]">
          Audience preview
        </p>
        {currentPreview ? (
          <>
            <p className="mt-4 text-sm text-[#625E6B]">
              {currentPreview.segmentName}
            </p>
            <p className="mt-2 text-[28px] font-semibold text-[#432C2C]">
              {currentPreview.netAudience.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-[#625E6B]">
              Estimated recipients
            </p>
            <p className="mt-3 text-xs text-[#625E6B]">
              {currentPreview.suppressedExcluded.toLocaleString()} suppressed
              contacts excluded
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-[#625E6B]">
            {selected ? "Loading audience preview…" : "Select a segment to preview its audience."}
          </p>
        )}
      </aside>
    </div>
  )
}