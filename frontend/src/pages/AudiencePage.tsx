import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { PageIntro } from "@/components/ui/PageIntro"
import { type Segment } from "@/types"

export function AudiencePage({
  segments,
  onCreate,
}: {
  segments: Segment[]
  onCreate: (name: string) => void
}) {
  const [search, setSearch] = useState("")
  const [newName, setNewName] = useState("")
  const visible = segments.filter((segment) =>
    segment.name.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <main className="mx-auto max-w-[1060px] px-5 py-8 sm:px-8 sm:py-10">
      <PageIntro
        description="Organize subscribers into focused segments and monitor audience health."
        eyebrow="Contacts"
        title="Audience"
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="overflow-hidden rounded-2xl border border-[#E3E1E7] bg-white">
          <div className="border-b border-[#ECEAEF] p-5 sm:flex sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#302D37]">Segments</h2>
              <p className="mt-1 text-xs text-[#625E6B]">
                {segments.length} active audience groups
              </p>
            </div>
            <div className="relative mt-3 sm:mt-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#625E6B]">
                <Icon name="search" size={15} />
              </span>
              <input
                className="h-9 w-full rounded-[9px] border border-[#E1DFE5] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#EF4444] sm:w-[200px]"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search segments"
                value={search}
              />
            </div>
          </div>
          <div className="divide-y divide-[#ECEAEF]">
            {visible.map((segment) => (
              <div className="flex items-center gap-4 p-5" key={segment.id}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#FEE2E2] text-[#B91C1C]">
                  <Icon name="users" size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#373440]">
                    {segment.name}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-[#625E6B]">
                    {segment.desc}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-[#373440]">
                    {segment.contacts}
                  </p>
                  <p className="mt-1 text-[10px] text-[#247A4D]">
                    {segment.growth}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside className="space-y-5">
          <section className="rounded-2xl bg-[#B91C1C] p-6 text-white">
            <Icon name="audience" size={20} />
            <p className="mt-5 text-[11px] font-semibold text-white/70">
              Total contacts
            </p>
            <p className="mt-1 text-[30px] font-semibold tracking-[-0.04em]">
              24,825
            </p>
            <p className="mt-2 text-xs text-white/70">
              1,920 added in the last 30 days
            </p>
          </section>
          <form
            className="rounded-2xl border border-[#E3E1E7] bg-white p-5"
            onSubmit={(event) => {
              event.preventDefault()
              if (!newName.trim()) return
              onCreate(newName.trim())
              setNewName("")
            }}
          >
            <p className="text-sm font-semibold text-[#302D37]">
              Create a segment
            </p>
            <p className="mt-1 text-xs leading-5 text-[#625E6B]">
              Start a new group for a targeted send.
            </p>
            <input
              className="field mt-4"
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Segment name"
              value={newName}
            />
            <Button className="mt-3 w-full" type="submit">
              <Icon name="plus" size={15} /> Add segment
            </Button>
          </form>
        </aside>
      </div>
    </main>
  )
}
