import { type Template } from "@/data/templates"

export function TemplatePreview({ template }: { template: Template }) {
  return (
    <div
      className={`relative aspect-[1.18] overflow-hidden rounded-t-xl ${template.color} p-4`}
    >
      <div className="mx-auto h-full w-[72%] overflow-hidden rounded-t-sm bg-white shadow-[0_8px_20px_rgba(45,40,60,.12)]">
        <div className="px-3 py-2">
          <div className={`h-1.5 w-10 rounded-full ${template.accent}`} />
          <div className="mt-4 h-2 w-[70%] rounded-full bg-[#34323B]" />
          <div className="mt-1.5 h-1.5 w-[84%] rounded-full bg-[#D6D3D9]" />
          <div className="mt-1 h-1.5 w-[60%] rounded-full bg-[#E2E0E4]" />
          {template.id !== 4 && (
            <div
              className={`mt-3 h-10 rounded-sm ${template.accent} opacity-80`}
            />
          )}
          <div className="mt-3 flex gap-1">
            <div className="h-1 flex-1 rounded-full bg-[#DDDADF]" />
            <div className="h-1 flex-1 rounded-full bg-[#EEECEF]" />
          </div>
        </div>
      </div>
    </div>
  )
}
