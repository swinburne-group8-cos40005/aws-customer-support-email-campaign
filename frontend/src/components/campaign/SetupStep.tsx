import { Icon } from "@/components/ui/Icon"

export function SetupStep({
  name,
  setName,
  subject,
  setSubject,
  body,
  setBody,
  fromName,
  setFromName,
  replyTo,
  setReplyTo,
}: {
  name: string
  setName: (value: string) => void
  subject: string
  setSubject: (value: string) => void
  body: string
  setBody: (value: string) => void
  fromName: string
  setFromName: (value: string) => void
  replyTo: string
  setReplyTo: (value: string) => void
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_310px]">
      <section className="rounded-2xl border border-[#E5E3E9] bg-white p-6 sm:p-8">
        <div className="mb-7">
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-[#282631]">
            Campaign details
          </h2>
          <p className="mt-1.5 text-sm text-[#625E6B]">
            Start with the essentials. You can update these anytime before
            sending.
          </p>
        </div>
        <div className="space-y-6">
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-[#403D48]">
              Campaign name
            </span>
            <input
              className="field"
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Spring product announcement"
              value={name}
            />
            <span className="mt-1.5 block text-xs text-[#625E6B]">
              Only visible to your team
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-[#403D48]">
              Email subject
            </span>
            <input
              className="field"
              onChange={(event) => setSubject(event.target.value)}
              value={subject}
            />
            <span className="mt-1.5 flex items-center gap-1.5 text-xs text-[#625E6B]">
              <Icon name="sparkles" size={13} /> Aim for 30–50 characters for
              better open rates
            </span>
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-[#403D48]">
                From name
              </span>
              <input
                className="field"
                onChange={(event) => setFromName(event.target.value)}
                placeholder="Sender name"
                value={fromName}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-[#403D48]">
                From email (title of email)
              </span>
              <input
                className="field"
                onChange={(event) => setReplyTo(event.target.value)}
                placeholder="reply@example.com"
                type="email"
                value={replyTo}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-[#403D48]">
              Email body
            </span>
            <textarea
              className="field min-h-24 resize-none py-3"
              onChange={(event) => setBody(event.target.value)}
              value={body}
            />
          </label>
        </div>
      </section>
      <aside className="space-y-4">
        <div className="rounded-2xl bg-[#FEF2F2] p-5">
          <div className="flex size-9 items-center justify-center rounded-[10px] bg-white text-[#DC2626] shadow-sm">
            <Icon name="sparkles" size={17} />
          </div>
          <p className="mt-4 text-[13px] font-semibold text-[#DC2626]">
            Quick tip
          </p>
          <p className="mt-1.5 text-xs leading-5 text-[#8B5A5A]">
            Personal subject lines can improve open rates by up to 26%. Add a
            first name variable in the editor.
          </p>
        </div>
      </aside>
    </div>
  )
}
