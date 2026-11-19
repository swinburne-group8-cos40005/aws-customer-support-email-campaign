import { useState } from "react"
import { TemplatePreview } from "@/components/campaign/TemplatePreview"
import { Icon } from "@/components/ui/Icon"
import { templates } from "@/data/templates"

export function TemplateStep({
  selected,
  setSelected,
}: {
  selected: number
  setSelected: (id: number) => void
}) {
  const [filter, setFilter] = useState("All")
  const [search, setSearch] = useState("")
  const visible = templates.filter(
    (template) =>
      (filter === "All" || template.category === filter) &&
      template.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-[#282631]">
            Choose a starting point
          </h2>
          <p className="mt-1 text-sm text-[#625E6B]">
            Pick a template, then make it completely yours.
          </p>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#625E6B]">
            <Icon name="search" size={16} />
          </span>
          <input
            className="h-10 w-full rounded-[10px] border border-[#E1DFE5] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#EF4444] sm:w-[210px]"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search templates"
            value={search}
          />
        </div>
      </div>
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {["All", "Newsletter", "Announcement", "Promotion", "Invitation"].map(
          (category) => (
            <button
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                filter === category
                  ? "border-[#DC2626] bg-[#DC2626] text-white"
                  : "border-[#E0DDE5] bg-white text-[#777381] hover:border-[#BBB6C4]"
              }`}
              key={category}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ),
        )}
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((template) => (
          <button
            className={`group overflow-hidden rounded-xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(39,35,54,.08)] ${
              selected === template.id
                ? "border-[#EF4444] ring-2 ring-[#EF4444]/15"
                : "border-[#E3E1E7]"
            }`}
            key={template.id}
            onClick={() => setSelected(template.id)}
          >
            <TemplatePreview template={template} />
            <div className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#33313E]">
                  {template.name}
                </p>
                <p className="mt-0.5 text-[11px] text-[#625E6B]">
                  {template.category}
                </p>
              </div>
              <span
                className={`flex size-5 items-center justify-center rounded-full border ${
                  selected === template.id
                    ? "border-[#DC2626] bg-[#DC2626] text-white"
                    : "border-[#D4D1D9]"
                }`}
              >
                {selected === template.id && <Icon name="check" size={12} />}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
