import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { PageIntro } from "@/components/ui/PageIntro"
import { type ApiTemplate } from "@/lib/api"

export function TemplatesPage({
  templates,
  selected,
  onSelect,
  onUseTemplate,
}: {
  templates: ApiTemplate[]
  selected: string
  onSelect: (id: string) => void
  onUseTemplate: () => void
}) {
  const [search, setSearch] = useState("")
  const visible = templates.filter((template) =>
    `${template.name} ${template.subjectTemplate}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  const hasSelectedTemplate = templates.some(
    (template) => template.templateId === selected,
  )

  return (
    <main className="mx-auto max-w-[1060px] px-5 py-8 sm:px-8 sm:py-10">
      <PageIntro
        action={
          <Button
            disabled={!hasSelectedTemplate}
            onClick={onUseTemplate}
          >
            Use selected template <Icon name="arrow-right" size={16} />
          </Button>
        }
        description="Browse the templates available in your account."
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

      {visible.length > 0 ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((template) => {
            const isSelected = selected === template.templateId

            return (
              <button
                aria-pressed={isSelected}
                className={`rounded-xl border bg-white p-5 text-left transition hover:shadow-[0_10px_30px_rgba(39,35,54,.08)] ${
                  isSelected
                    ? "border-[#EF4444] ring-2 ring-[#EF4444]/15"
                    : "border-[#E3E1E7]"
                }`}
                key={template.templateId}
                onClick={() => onSelect(template.templateId)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[#33313E]">
                    {template.name}
                  </p>
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                      isSelected
                        ? "border-[#DC2626] bg-[#DC2626] text-white"
                        : "border-[#D4D1D9]"
                    }`}
                  >
                    {isSelected && <Icon name="check" size={12} />}
                  </span>
                </div>
                <p className="mt-3 text-xs text-[#625E6B]">
                  {template.subjectTemplate}
                </p>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="mt-6 text-sm text-[#625E6B]">
          {templates.length === 0
            ? "No templates are available."
            : "No templates match your search."}
        </p>
      )}
    </main>
  )
}