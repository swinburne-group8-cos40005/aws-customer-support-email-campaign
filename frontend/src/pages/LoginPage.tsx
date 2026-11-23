import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Logo } from "@/components/ui/Logo"
import { ThemeToggle } from "@/components/ui/ThemeToggle"

export function LoginPage({
  darkMode,
  error,
  onLogin,
  onToggleTheme,
}: {
  darkMode: boolean
  error: string
  onLogin: () => void
  onToggleTheme: () => void
}) {
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
            PostlyMail
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
        </div>
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

          {error && (
            <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <Button className="mt-8 h-12 w-full text-sm" onClick={onLogin}>
            Continue to sign in <Icon name="arrow-right" size={17} />
          </Button>

          <p className="mt-8 text-center text-xs text-[#625E6B]">
            Sign-in is securely handled by Cognito.
          </p>
        </div>
      </section>
    </main>
  )
}