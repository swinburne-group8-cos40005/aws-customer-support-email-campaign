import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Logo } from "@/components/ui/Logo"
import { ThemeToggle } from "@/components/ui/ThemeToggle"

export function LoginPage({
  darkMode,
  onLogin,
  onToggleTheme,
}: {
  darkMode: boolean
  onLogin: () => void
  onToggleTheme: () => void
}) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <main
      className={`${
        darkMode ? "theme-dark" : ""
      } relative min-h-screen bg-[#F7F7FA] transition-colors lg:grid lg:grid-cols-[1.02fr_.98fr]`}
    >
      <div className="absolute right-6 top-6 z-20">
        <ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} />
      </div>
      <section className="relative hidden overflow-hidden bg-[#171622] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-28 -top-28 size-[380px] rounded-full bg-[#EF4444]/25 blur-3xl" />
        <div className="absolute -bottom-40 left-10 size-[430px] rounded-full bg-[#A9F6CC]/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[#EF4444]">
            <Icon name="paper-plane" size={18} />
          </div>
          <span className="text-[20px] font-bold tracking-[-0.03em]">
            Placeholder Name
          </span>
        </div>
        <div className="relative z-10 my-auto max-w-[530px]">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-xs font-medium text-[#CCC9D8]">
            <Icon name="sparkles" size={14} />
            Campaigns that connect
          </div>
          <h1 className="text-[52px] font-semibold leading-[1.06] tracking-[-0.05em]">
            Turn every send into a meaningful moment.
          </h1>
          <p className="mt-6 max-w-[480px] text-[17px] leading-7 text-[#AAA6B8]">
            Build thoughtful campaigns, reach the right audience, and grow your
            customer relationships from one calm workspace.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-4">
            {[
              ["24.8%", "Avg. open rate"],
              ["2.4×", "More engagement"],
              ["99.9%", "Delivery rate"],
            ].map(([value, label]) => (
              <div className="border-l border-white/15 pl-4" key={label}>
                <div className="text-2xl font-semibold tracking-[-0.03em]">
                  {value}
                </div>
                <div className="mt-1 text-xs text-[#8F8A9F]">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-[#777283]">
          Trusted by growing teams to send better email.
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-12 lg:hidden">
            <Logo />
          </div>
          <p className="text-sm font-semibold text-[#DC2626]">ADMIN PORTAL</p>
          <h2 className="mt-3 text-[34px] font-semibold tracking-[-0.04em] text-[#20202B]">
            Welcome back!
          </h2>
          <p className="mt-2 text-[15px] text-[#777382]">
            Sign in to manage your campaigns and audience.
          </p>
          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              onLogin()
            }}
          >
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-[#383542]">
                Email address
              </span>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777281]">
                  <Icon name="mail" size={17} />
                </span>
                <input
                  className="h-12 w-full rounded-xl border border-[#DEDBE5] bg-white pl-11 pr-4 text-sm text-[#272532] outline-none transition placeholder:text-[#6F6A78] focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/10"
                  defaultValue="admin@postly.com"
                  type="email"
                />
              </div>
            </label>
            <label className="block">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#383542]">
                  Password
                </span>
                <button
                  className="text-xs font-semibold text-[#DC2626]"
                  type="button"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  className="h-12 w-full rounded-xl border border-[#DEDBE5] bg-white px-4 pr-20 text-sm text-[#272532] outline-none transition placeholder:text-[#6F6A78] focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/10"
                  defaultValue="password"
                  type={showPassword ? "text" : "password"}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#625E6B] hover:text-[#4D4958]"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  <Icon name="eye" size={18} />
                </button>
              </div>
            </label>
            <label className="flex items-center gap-2.5 text-[13px] text-[#625E6D]">
              <input
                className="size-4 accent-[#DC2626]"
                defaultChecked
                type="checkbox"
              />
              Keep me signed in for 30 days
            </label>
            <Button className="h-12 w-full text-sm" type="submit">
              Sign in <Icon name="arrow-right" size={17} />
            </Button>
          </form>
          <p className="mt-8 text-center text-xs text-[#625E6B]">
            Protected by enterprise-grade security
          </p>
        </div>
      </section>
    </main>
  )
}
