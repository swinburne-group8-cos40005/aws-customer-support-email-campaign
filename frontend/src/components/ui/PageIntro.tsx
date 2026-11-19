import { type ReactNode } from "react"

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#B91C1C]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[#292631]">
          {title}
        </h1>
        <p className="mt-2 max-w-[600px] text-sm leading-6 text-[#625E6B]">
          {description}
        </p>
      </div>
      {action}
    </div>
  )
}
