import { Icon } from "@/components/ui/Icon"
import { type ApiTemplate } from "@/lib/api"

export function TemplateStep({
  templates,
  selected,
  setSelected,
}: {
  templates: ApiTemplate[]
  selected: string
  setSelected: (id: string) => void
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-[#282631]">
        Choose a starting point
      </h2>
      <p className="mt-1 text-sm text-[#625E6B]">
        Select a template from your account.
      </p>

      {templates.length === 0 ? (
        <p className="mt-6 text-sm text-[#625E6B]">No templates are available.</p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <button
              className={`rounded-xl border bg-white p-5 text-left ${
                selected === template.templateId
                  ? "border-[#EF4444] ring-2 ring-[#EF4444]/15"
                  : "border-[#E3E1E7]"
              }`}
              key={template.templateId}
              onClick={() => setSelected(template.templateId)}
              type="button"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold text-[#33313E]">
                  {template.name}
                </span>
                {selected === template.templateId && (
                  <Icon name="check" size={16} />
                )}
              </span>
              <span className="mt-2 block text-sm text-[#625E6B]">
                {template.subjectTemplate}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}