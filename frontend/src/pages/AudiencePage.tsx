import { useState, type FormEvent } from "react"
import { AddSegmentButton } from "@/components/ui/AddSegmentButton"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { PageIntro } from "@/components/ui/PageIntro"
import {
  campaignApi,
  type ApiSegment,
  type CreateSegmentBody,
  type CustomerPreferences,
} from "@/lib/api"

export function AudiencePage({
  segments,
  onCreateSegment,
  onReload,
}: {
  segments: ApiSegment[]
  onCreateSegment: (body: CreateSegmentBody) => Promise<ApiSegment>
  onReload: () => Promise<void>
}) {
  const [search, setSearch] = useState("")
  const [segmentName, setSegmentName] = useState("")
  const [segmentDescription, setSegmentDescription] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [preferences, setPreferences] = useState<CustomerPreferences | null>(null)
  const [reason, setReason] = useState("customer_requested")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const visible = segments.filter((segment) =>
    `${segment.name} ${segment.description ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  )

  async function createSegment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(""); setNotice("")
    try {
      await campaignApi.createSegment({
        name: segmentName.trim(),
        description: segmentDescription.trim() || undefined,
      })
      setSegmentName(""); setSegmentDescription("")
      await onReload()
      setNotice("Audience segment created.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the segment.")
    } finally { setBusy(false) }
  }

  async function loadPreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(""); setNotice(""); setPreferences(null)
    try {
      const result = await campaignApi.getCustomerPreferences(customerId.trim())
      setPreferences(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load customer preferences.")
    } finally { setBusy(false) }
  }

  async function updatePreference(isOptedOut: boolean) {
    if (!customerId.trim()) return
    setBusy(true); setError(""); setNotice("")
    try {
      const result = await campaignApi.updateCustomerPreferences(customerId.trim(), {
        isOptedOut,
        ...(isOptedOut ? { reason } : {}),
      })
      setPreferences(result)
      setNotice(isOptedOut ? "Customer opted out." : "Customer opted in.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update customer preferences.")
    } finally { setBusy(false) }
  }

  return (
    <main className="mx-auto max-w-[1060px] px-5 py-8 sm:px-8 sm:py-10">
      <PageIntro description="Manage audience segments and customer communication preferences." eyebrow="Contacts" title="Audience" />

      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>}

      <form onSubmit={(event) => void createSegment(event)} className="mt-7 rounded-2xl border border-[#E3E1E7] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#302D37]">Create audience segment</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-[#625E6B]">Segment name
            <input required maxLength={120} className="field mt-1" value={segmentName} onChange={(e) => setSegmentName(e.target.value)} />
          </label>
          <label className="text-xs font-medium text-[#625E6B]">Description
            <input maxLength={500} className="field mt-1" value={segmentDescription} onChange={(e) => setSegmentDescription(e.target.value)} />
          </label>
        </div>
        <Button type="submit" disabled={busy || !segmentName.trim()} className="mt-4">{busy ? "Saving…" : "Create segment"}</Button>
      </form>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#E3E1E7] bg-white">
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
        {visible.length > 0 ? <div className="divide-y divide-[#ECEAEF]">
          {visible.map((segment) => <div className="flex items-center gap-4 p-5" key={segment.segmentId}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#FEE2E2] text-[#B91C1C]"><Icon name="users" size={18} /></span>
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#373440]">{segment.name}</p><p className="mt-1 truncate text-[11px] text-[#625E6B]">{segment.description || "No description"}</p></div>
          </div>)}
        </div> : <p className="p-5 text-sm text-[#625E6B]">{segments.length === 0 ? "No segments are available." : "No segments match your search."}</p>}
      </section>

      <section className="mt-6 rounded-2xl border border-[#E3E1E7] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#302D37]">Customer preferences</h2>
        <p className="mt-1 text-xs text-[#625E6B]">Look up a customer by ID, then update their email opt-in status.</p>
        <form onSubmit={(event) => void loadPreferences(event)} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input required className="field flex-1" placeholder="Customer ID" value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
          <Button type="submit" disabled={busy || !customerId.trim()}>Load preferences</Button>
        </form>
        {preferences && <div className="mt-4 rounded-xl bg-[#F8F7FB] p-4">
          <p className="text-xs text-[#625E6B]">Customer: <strong className="break-all">{customerId}</strong></p>
          <p className="mt-2 text-sm font-semibold text-[#302D37]">Email status: {preferences.isOptedOut ? "Opted out" : "Opted in"}</p>
          {preferences.reason && <p className="mt-1 text-xs text-[#625E6B]">Reason: {preferences.reason}</p>}
          <label className="mt-3 block text-xs text-[#625E6B]">Opt-out reason
            <input className="field mt-1 max-w-sm" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={busy || preferences.isOptedOut} onClick={() => void updatePreference(true)}>Opt out</Button>
            <Button variant="secondary" disabled={busy || !preferences.isOptedOut} onClick={() => void updatePreference(false)}>Opt in</Button>
          </div>
        </div>}
      </section>
    </main>
  )
}
