import { useState, type FormEvent } from "react"
import { Icon } from "@/components/ui/Icon"
import { type ApiSegment, type CreateSegmentBody } from "@/lib/api"

export function AddSegmentButton({
  onCreate,
  onCreated,
}: {
  onCreate: (body: CreateSegmentBody) => Promise<ApiSegment>
  onCreated?: (segment: ApiSegment) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  function close() {
    setOpen(false)
    setError("")
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    setSaving(true)
    try {
      const segment = await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        rules: {},
      })
      onCreated?.(segment)
      setName("")
      setDescription("")
      close()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create this segment.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[9px] bg-[#EF4444] px-3 text-xs font-semibold text-white hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Icon name="plus" size={15} />
        Add custom segment
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) close()
          }}
        >
          <section
            aria-labelledby="create-segment-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
          >
            <h2
              className="text-lg font-semibold text-[#302D37]"
              id="create-segment-title"
            >
              Add custom audience segment
            </h2>
            <p className="mt-1 text-sm text-[#625E6B]">
              Define a name and optional description for this segment.
            </p>
            <form className="mt-5 space-y-4" onSubmit={submit}>
              <label className="block text-xs font-medium text-[#403D48]">
                Name
                <input
                  autoFocus
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#E1DFE5] px-3 text-sm outline-none focus:border-[#EF4444]"
                  maxLength={150}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </label>
              <label className="block text-xs font-medium text-[#403D48]">
                Description
                <textarea
                  className="mt-1.5 min-h-20 w-full rounded-lg border border-[#E1DFE5] p-3 text-sm outline-none focus:border-[#EF4444]"
                  maxLength={2000}
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              </label>
              {error && (
                <p className="text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  className="h-9 rounded-[9px] border border-[#E1DFE5] px-3 text-xs font-semibold text-[#403D48] disabled:opacity-60"
                  disabled={saving}
                  onClick={close}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="h-9 rounded-[9px] bg-[#EF4444] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving || !name.trim()}
                  type="submit"
                >
                  {saving ? "Adding…" : "Add segment"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
