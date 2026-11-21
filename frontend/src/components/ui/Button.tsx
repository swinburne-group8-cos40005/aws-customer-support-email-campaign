import { type ReactNode } from "react"

export function Button({
  children,
  variant = "primary",
  className = "",
  onClick,
  type = "button",
  disabled = false,
}: {
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost"
  className?: string
  onClick?: () => void
  type?: "button" | "submit"
  disabled?: boolean
}) {
  const variants = {
    primary:
      "bg-[#DC2626] text-white shadow-[0_5px_14px_rgba(220,38,38,.22)] hover:bg-[#B91C1C]",
    secondary:
      "border border-[#E3E2EA] bg-white text-[#33313F] hover:border-[#CAC7D5] hover:bg-[#F8F7FB]",
    ghost: "text-[#6D6979] hover:bg-[#F3F1F8] hover:text-[#272532]",
  }

  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  )
}