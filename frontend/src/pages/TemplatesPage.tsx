import { useState } from "react"
import { TemplatePreview } from "@/components/campaign/TemplatePreview"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { PageIntro } from "@/components/ui/PageIntro"
import { templates } from "@/data/templates"

export function TemplatesPage({
  selected,
  onSelect,
  onUseTemplate,
}: {
  selected: number
  onSelect: (id: number) => void
  onUseTemplate: () => void
}) {
  const [search, setSearch] = useState("")
  const visible = templates.filter((template) =>
    template.name.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <main className="mx-auto max-w-[1060px] px-5 py-8 sm:px-8 sm:py-10">
      <PageIntro
        action={
          <Button onClick={onUseTemplate}>
            Use selected template <Icon name="arrow-right" size={16} />
          </Button>
        }
        description="Browse flexible, mobile-ready designs for your next campaign."
        eyebrow="Library"
        title="Templates"
      />
      <div className="relative mt-7 max-w-[320px]">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#625E6B]">
          <Icon name="search" size={16} />
        </span>
        <input
          className="field pl-9"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search templates"
          value={search}
        />
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
            onClick={() => onSelect(template.id)}
          >
            <TemplatePreview template={template} />
            <div className="flex items-center justify-between p-4">
              <div>
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
    </main>
  )
}
