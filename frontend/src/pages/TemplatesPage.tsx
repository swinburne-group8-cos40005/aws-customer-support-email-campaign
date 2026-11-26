import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { PageIntro } from "@/components/ui/PageIntro"
import { campaignApi, type ApiTemplate, type TemplateInput } from "@/lib/api"

export function TemplatesPage({
  templates,
  selected,
  onSelect,
  onUseTemplate,
  onReload,
}: {
  templates: ApiTemplate[]
  selected: string
  onSelect: (id: string) => void
  onUseTemplate: () => void
  onReload: () => Promise<void>
}) {
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [subjectTemplate, setSubjectTemplate] = useState("")
  const [bodyText, setBodyText] = useState("")
  const [bodyHtml, setBodyHtml] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const visible = templates.filter((template) =>
    `${template.name} ${template.subjectTemplate}`.toLowerCase().includes(search.toLowerCase()),
  )
  const hasSelectedTemplate = templates.some((template) => template.templateId === selected)

  function startCreate() {
    setEditing(null)
    setName("")
    setSubjectTemplate("")
    setBodyText("")
    setBodyHtml("")
    setError("")
    setShowForm(true)
  }

  function startEdit(template: ApiTemplate) {
    setEditing(template.templateId)
    setName(template.name)
    setSubjectTemplate(template.subjectTemplate)
    setBodyText(template.bodyText ?? "")
    setBodyHtml(template.bodyHtml ?? "")
    setError("")
    setShowForm(true)
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setNotice("")
    const payload: TemplateInput = {
      name: name.trim(),
      subjectTemplate: subjectTemplate.trim(),
      bodyText: bodyText || null,
      bodyHtml: bodyHtml || null,
    }
    try {
      if (editing) await campaignApi.updateTemplate(editing, payload)
      else await campaignApi.createTemplate(payload)
      await onReload()
      setShowForm(false)
      setNotice(editing ? "Template updated." : "Template created.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the template.")
    } finally {
      setBusy(false)
    }
  }

  async function removeTemplate(template: ApiTemplate) {
    if (!window.confirm(`Delete "${template.name}"?`)) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await campaignApi.deleteTemplate(template.templateId)
      await onReload()
      setNotice("Template deleted.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the template.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-[1060px] px-5 py-8 sm:px-8 sm:py-10">
      <PageIntro
        action={<div className="flex flex-wrap gap-2">
          <Button onClick={startCreate}><Icon name="plus" size={16} /> New template</Button>
          <Button disabled={!hasSelectedTemplate} onClick={onUseTemplate}>Use selected template <Icon name="arrow-right" size={16} /></Button>
        </div>}
        description="Browse and manage the templates available in your account."
        eyebrow="Library"
        title="Templates"
      />

      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>}

      {showForm && (
        <form onSubmit={(event) => void saveTemplate(event)} className="mt-6 space-y-3 rounded-2xl border border-[#E3E1E7] bg-white p-5">
          <h2 className="text-sm font-semibold">{editing ? "Edit template" : "Create template"}</h2>
          <label className="block text-xs font-medium text-[#625E6B]">Name
            <input required maxLength={120} className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-[#625E6B]">Subject
            <input required maxLength={200} className="field mt-1" value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-[#625E6B]">Plain-text body
            <textarea className="field mt-1 min-h-24" value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-[#625E6B]">HTML body
            <textarea className="field mt-1 min-h-24 font-mono" value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save template"}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="relative mt-7 max-w-[320px]">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#625E6B]"><Icon name="search" size={16} /></span>
        <input className="field pl-9" onChange={(event) => setSearch(event.target.value)} placeholder="Search templates" value={search} />
      </div>

      {visible.length > 0 ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((template) => {
            const isSelected = selected === template.templateId
            return (
              <article className={`rounded-xl border bg-white p-5 ${isSelected ? "border-[#EF4444] ring-2 ring-[#EF4444]/15" : "border-[#E3E1E7]"}`} key={template.templateId}>
                <button aria-pressed={isSelected} className="w-full text-left" onClick={() => onSelect(template.templateId)} type="button">
                  <p className="text-[13px] font-semibold text-[#33313E]">{template.name}</p>
                  <p className="mt-3 text-xs text-[#625E6B]">{template.subjectTemplate}</p>
                </button>
                <div className="mt-4 flex gap-2 border-t pt-3">
                  <button className="text-xs font-semibold text-[#B91C1C]" onClick={() => startEdit(template)}>Edit</button>
                  <button disabled={busy} className="text-xs font-semibold text-[#625E6B] disabled:opacity-50" onClick={() => void removeTemplate(template)}>Delete</button>
                </div>
              </article>
            )
          })}
        </div>
      ) : <p className="mt-6 text-sm text-[#625E6B]">{templates.length === 0 ? "No templates are available." : "No templates match your search."}</p>}
    </main>
  )
}
