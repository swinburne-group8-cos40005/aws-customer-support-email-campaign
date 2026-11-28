import { useState } from "react"
import { AddSegmentButton } from "@/components/ui/AddSegmentButton"
import { Icon } from "@/components/ui/Icon"
import { PageIntro } from "@/components/ui/PageIntro"
import { type ApiSegment, type CreateSegmentBody } from "@/lib/api"

export function AudiencePage({
  segments,
  onCreateSegment,
}: {
  segments: ApiSegment[]
  onCreateSegment: (body: CreateSegmentBody) => Promise<ApiSegment>
}) {
  const [search, setSearch] = useState("")
  const visible = segments.filter((segment) =>
    `${segment.name} ${segment.description ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  return (
    <main className="mx-auto max-w-[1060px] px-5 py-8 sm:px-8 sm:py-10">
      <PageIntro
        description="Browse the audience segments available to your campaigns."
        eyebrow="Contacts"
        title="Audience"
      />

      <section className="mt-8 overflow-hidden rounded-2xl border border-[#E3E1E7] bg-white">
        <div className="border-b border-[#ECEAEF] p-5 sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#302D37]">Segments</h2>
            <p className="mt-1 text-xs text-[#625E6B]">
              {segments.length} audience{" "}
              {segments.length === 1 ? "segment" : "segments"}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-0">
            <AddSegmentButton onCreate={onCreateSegment} />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#625E6B]">
                <Icon name="search" size={15} />
              </span>
              <input
                className="h-9 w-full rounded-[9px] border border-[#E1DFE5] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#EF4444] sm:w-[220px]"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search segments"
                value={search}
              />
            </div>
          </div>
        </div>

        {visible.length > 0 ? (
          <div className="divide-y divide-[#ECEAEF]">
            {visible.map((segment) => (
              <div
                className="flex items-center gap-4 p-5"
                key={segment.segmentId}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#FEE2E2] text-[#B91C1C]">
                  <Icon name="users" size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#373440]">
                    {segment.name}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-[#625E6B]">
                    {segment.description || "No description"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-5 text-sm text-[#625E6B]">
            {segments.length === 0
              ? "No segments are available."
              : "No segments match your search."}
          </p>
        )}
      </section>
    </main>
  )
}
