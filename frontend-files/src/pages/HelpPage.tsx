import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"

export function HelpPage() {
  const topics = [
    ["campaign", "Create and send campaigns", "Templates, setup, and delivery"],
    ["audience", "Manage your audience", "Contacts, segments, and imports"],
    ["layers", "Design better emails", "Layout and content best practices"],
    ["settings", "Workspace and account", "Team, security, and preferences"],
  ] as const
  const [query, setQuery] = useState("")
  return (
    <main className="mx-auto max-w-[960px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="rounded-[24px] bg-[#241F29] px-6 py-10 text-center text-white sm:px-10 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#FCA5A5]">
          Postly support
        </p>
        <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.04em]">
          How can we help?
        </h1>
        <div className="relative mx-auto mt-6 max-w-[520px]">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#777381]">
            <Icon name="search" size={18} />
          </span>
          <input
            className="h-12 w-full rounded-xl bg-white pl-11 pr-4 text-sm text-[#33313F] outline-none ring-4 ring-white/10 placeholder:text-[#777381] focus:ring-[#EF4444]/30"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search guides and answers"
            value={query}
          />
        </div>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {topics
          .filter(([, title, description]) =>
            `${title} ${description}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map(([icon, title, description]) => (
            <button
              className="flex items-center gap-4 rounded-2xl border border-[#E3E1E7] bg-white p-5 text-left transition hover:border-[#FCA5A5] hover:shadow-[0_8px_24px_rgba(39,35,54,.06)]"
              key={title}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#B91C1C]">
                <Icon name={icon} size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#302D37]">
                  {title}
                </span>
                <span className="mt-1 block text-xs text-[#625E6B]">
                  {description}
                </span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
      </div>
      <section className="mt-7 rounded-2xl border border-[#E3E1E7] bg-white p-6 sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#302D37]">
            Still need a hand?
          </h2>
          <p className="mt-1 text-xs text-[#625E6B]">
            Our support team typically replies within one business day.
          </p>
        </div>
        <Button className="mt-4 sm:mt-0" variant="secondary">
          <Icon name="mail" size={15} /> Contact support
        </Button>
      </section>
    </main>
  )
}
