import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Logo } from "@/components/ui/Logo"
import { ThemeToggle } from "@/components/ui/ThemeToggle"

type AuthStep = "login" | "register" | "confirm"

const passwordRequirements =
  "Use at least 12 characters with an uppercase letter, a lowercase letter, a number, and a symbol."

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password)
  )
}

export function LoginPage({
  darkMode,
  error,
  onSignIn,
  onSignUp,
  onConfirmSignUp,
  onResendConfirmationCode,
  onToggleTheme,
}: {
  darkMode: boolean
  error: string
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<boolean>
  onConfirmSignUp: (email: string, code: string) => Promise<void>
  onResendConfirmationCode: (email: string) => Promise<void>
  onToggleTheme: () => void
}) {
  const [step, setStep] = useState<AuthStep>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [confirmationCode, setConfirmationCode] = useState("")
  const [formError, setFormError] = useState("")
  const [notice, setNotice] = useState("")
  const [pending, setPending] = useState(false)

  const resetMessages = () => {
    setFormError("")
    setNotice("")
  }

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetMessages()
    setPending(true)
    try {
      await onSignIn(email.trim(), password)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Could not sign in. Please try again.")
    } finally {
      setPending(false)
    }
  }

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetMessages()

    if (!isStrongPassword(password)) {
      setFormError(passwordRequirements)
      return
    }
    if (password !== confirmPassword) {
      setFormError("The passwords do not match.")
      return
    }

    setPending(true)
    try {
      const alreadyConfirmed = await onSignUp(email.trim(), password)
      if (alreadyConfirmed) {
        setNotice("Your account is ready. Signing you in...")
        await onSignIn(email.trim(), password)
      } else {
        setPassword("")
        setConfirmPassword("")
        setStep("confirm")
        setNotice(`We sent a verification code to ${email.trim()}.`)
      }
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Could not create your account. Please try again.")
    } finally {
      setPending(false)
    }
  }

  const handleConfirmSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetMessages()
    setPending(true)
    try {
      await onConfirmSignUp(email.trim(), confirmationCode.trim())
      setStep("login")
      setPassword("")
      setConfirmPassword("")
      setConfirmationCode("")
      setNotice("Email confirmed. Sign in to continue.")
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Could not confirm your email. Please try again.")
    } finally {
      setPending(false)
    }
  }

  const handleResendCode = async () => {
    resetMessages()
    setPending(true)
    try {
      await onResendConfirmationCode(email.trim())
      setNotice(`A new verification code was sent to ${email.trim()}.`)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Could not resend the code. Please try again.")
    } finally {
      setPending(false)
    }
  }

  const handleRequestConfirmationCode = async () => {
    resetMessages()
    if (!email.trim()) {
      setFormError("Enter your email address first.")
      return
    }

    setPending(true)
    try {
      await onResendConfirmationCode(email.trim())
      setStep("confirm")
      setNotice(`A verification code was sent to ${email.trim()}.`)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Could not send a verification code. Please try again.")
    } finally {
      setPending(false)
    }
  }

  const changeStep = (nextStep: AuthStep) => {
    setStep(nextStep)
    setPassword("")
    setConfirmPassword("")
    setConfirmationCode("")
    resetMessages()
  }

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
            {step === "register"
              ? "Create your account"
              : step === "confirm"
                ? "Check your email"
                : "Welcome back!"}
          </h2>
          <p className="mt-2 text-[15px] text-[#777382]">
            {step === "register"
              ? "Create an account to manage your campaigns."
              : step === "confirm"
                ? "Enter the verification code we sent you."
                : "Sign in to manage your campaigns and audience."}
          </p>

          {(formError || error) && (
            <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
              {formError || error}
            </p>
          )}
          {notice && (
            <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-800" role="status">
              {notice}
            </p>
          )}

          {step === "login" && (
            <form className="mt-8 space-y-4" onSubmit={handleSignIn}>
              <label className="block text-sm font-medium text-[#3F3B48]">
                Email address
                <input
                  autoComplete="email"
                  className="field mt-2"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="block text-sm font-medium text-[#3F3B48]">
                Password
                <input
                  autoComplete="current-password"
                  className="field mt-2"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              <Button className="h-12 w-full text-sm" disabled={pending} type="submit">
                {pending ? "Signing in..." : "Sign in"}
                {!pending && <Icon name="arrow-right" size={17} />}
              </Button>
            </form>
          )}

          {step === "login" && (
            <button
              className="mt-4 w-full text-center text-xs font-medium text-[#777382] hover:text-[#B91C1C] disabled:opacity-60"
              disabled={pending}
              onClick={() => void handleRequestConfirmationCode()}
              type="button"
            >
              Resend email verification code
            </button>
          )}

          {step === "register" && (
            <form className="mt-8 space-y-4" onSubmit={handleSignUp}>
              <label className="block text-sm font-medium text-[#3F3B48]">
                Email address
                <input
                  autoComplete="email"
                  className="field mt-2"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="block text-sm font-medium text-[#3F3B48]">
                Password
                <input
                  autoComplete="new-password"
                  className="field mt-2"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              <p className="-mt-2 text-xs leading-5 text-[#777382]">
                {passwordRequirements}
              </p>
              <label className="block text-sm font-medium text-[#3F3B48]">
                Confirm password
                <input
                  autoComplete="new-password"
                  className="field mt-2"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  type="password"
                  value={confirmPassword}
                />
              </label>
              <Button className="h-12 w-full text-sm" disabled={pending} type="submit">
                {pending ? "Creating account..." : "Create account"}
              </Button>
            </form>
          )}

          {step === "confirm" && (
            <form className="mt-8 space-y-4" onSubmit={handleConfirmSignUp}>
              <label className="block text-sm font-medium text-[#3F3B48]">
                Verification code
                <input
                  autoComplete="one-time-code"
                  className="field mt-2"
                  inputMode="numeric"
                  onChange={(event) => setConfirmationCode(event.target.value)}
                  required
                  value={confirmationCode}
                />
              </label>
              <Button className="h-12 w-full text-sm" disabled={pending} type="submit">
                {pending ? "Verifying..." : "Verify email"}
              </Button>
              <button
                className="w-full py-2 text-sm font-semibold text-[#B91C1C] disabled:opacity-60"
                disabled={pending}
                onClick={() => void handleResendCode()}
                type="button"
              >
                Resend verification code
              </button>
            </form>
          )}

          {step !== "confirm" && (
            <p className="mt-7 text-center text-sm text-[#625E6B]">
              {step === "login" ? "New to PostlyMail?" : "Already have an account?"}{" "}
              <button
                className="font-semibold text-[#B91C1C] hover:underline"
                onClick={() => changeStep(step === "login" ? "register" : "login")}
                type="button"
              >
                {step === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>
          )}

          <p className="mt-8 text-center text-xs text-[#625E6B]">
            Sign in securely with your Cognito account.
          </p>
        </div>
      </section>
    </main>
  )
}
