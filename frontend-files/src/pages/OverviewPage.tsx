import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { PageIntro } from "@/components/ui/PageIntro"

export function OverviewPage({ onCreate }: { onCreate: () => void }) {
  const stats = [
    { label: "Total subscribers", value: "24,825", change: "+8.4%" },
    { label: "Average open rate", value: "48.2%", change: "+2.1%" },
    { label: "Emails delivered", value: "81,490", change: "+12.6%" },
  ]
  const recent = [
    ["Spring product announcement", "Sent", "12,840", "52.4%"],
    ["March customer update", "Sent", "8,420", "46.8%"],
    ["Welcome to Postly", "Draft", "—", "—"],
  ]

  return (
    <main className="mx-auto max-w-[1060px] px-5 py-8 sm:px-8 sm:py-10">
      <PageIntro
        action={
          <Button onClick={onCreate}>
            <Icon name="plus" size={16} /> Create campaign
          </Button>
        }
        description="Track your audience growth and see how your latest campaigns are performing."
        eyebrow="Workspace"
        title="Good morning, Hieu"
      />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <section
            className="rounded-2xl border border-[#E3E1E7] bg-white p-5"
            key={stat.label}
          >
            <p className="text-xs font-medium text-[#625E6B]">{stat.label}</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-[26px] font-semibold tracking-[-0.04em] text-[#302D37]">
                {stat.value}
              </p>
              <span className="rounded-full bg-[#DEF5E7] px-2 py-1 text-[10px] font-bold text-[#247A4D]">
                {stat.change}
              </span>
            </div>
            <div className="mt-5 flex h-8 items-end gap-1">
              {[35, 48, 42, 65, 58, 76, 88, 72, 94, 100].map(
                (height, index) => (
                  <span
                    className="flex-1 rounded-sm bg-[#FECACA] last:bg-[#DC2626]"
                    key={index}
                    style={{ height: `${height}%` }}
                  />
                ),
              )}
            </div>
          </section>
        ))}
      </div>
      <section className="mt-6 overflow-hidden rounded-2xl border border-[#E3E1E7] bg-white">
        <div className="flex items-center justify-between border-b border-[#ECEAEF] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-sm font-semibold text-[#302D37]">
              Recent campaigns
            </h2>
            <p className="mt-1 text-xs text-[#625E6B]">
              Your latest sends and drafts
            </p>
          </div>
          <button
            className="text-xs font-semibold text-[#B91C1C]"
            onClick={onCreate}
          >
            View campaigns
          </button>
        </div>
        <div className="divide-y divide-[#ECEAEF]">
          {recent.map(([name, status, recipients, openRate]) => (
            <div
              className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 sm:grid-cols-[1fr_100px_100px_80px] sm:px-6"
              key={name}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#FEE2E2] text-[#B91C1C]">
                  <Icon name="mail" size={16} />
                </span>
                <p className="truncate text-xs font-semibold text-[#3D3945]">
                  {name}
                </p>
              </div>
              <span
                className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  status === "Sent"
                    ? "bg-[#DEF5E7] text-[#247A4D]"
                    : "bg-[#F0EFF2] text-[#625E6B]"
                }`}
              >
                {status}
              </span>
              <span className="hidden text-xs text-[#625E6B] sm:block">
                {recipients}
              </span>
              <span className="hidden text-xs font-semibold text-[#3D3945] sm:block">
                {openRate}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
