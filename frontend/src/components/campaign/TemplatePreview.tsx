import { type Template } from "@/data/templates"

export function TemplatePreview({ template }: { template: Template }) {
  return (
    <div
      className={`relative aspect-[1.18] overflow-hidden rounded-t-xl ${template.color} p-4`}
    >
      <div className="mx-auto h-full w-[72%] overflow-hidden rounded-t-sm bg-white shadow-[0_8px_20px_rgba(45,40,60,.12)]">
        <div className="px-3 py-2">
          <div className={`h-1.5 w-10 rounded-full ${template.accent}`} />
          <p className="mt-3 line-clamp-2 text-[9px] font-semibold leading-3 text-[#34323B]">
            {template.subject}
          </p>
          <p className="mt-1.5 line-clamp-4 text-[8px] leading-3 text-[#716D78]">
            {template.body}
          </p>
          {template.id !== 4 && (
            <div
              className={`mt-2 h-8 rounded-sm ${template.accent} opacity-80`}
            />
          )}
          <div className="mt-2 flex gap-1">
            <div className="h-1 flex-1 rounded-full bg-[#DDDADF]" />
            <div className="h-1 flex-1 rounded-full bg-[#EEECEF]" />
          </div>
        </div>
      </div>
    </div>
  )
}
