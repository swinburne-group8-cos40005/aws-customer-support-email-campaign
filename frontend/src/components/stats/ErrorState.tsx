import { beginSignIn } from "@/lib/auth"
import { type ApiRequestError } from "@/api/client"
import { Button } from "@/components/ui/Button"

/**
 * Error panel with a retry. For 401s it offers a way to restart Cognito sign-in.
 */
export function ErrorState({
  error,
  onRetry,
  compact = false,
}: {
  error: ApiRequestError
  onRetry: () => void
  compact?: boolean
}) {
  const needsSignIn = error.status === 401 || error.code === "AUTH_REQUIRED"

  return (
    <div className={`${compact ? "px-6 py-6" : "mt-8 rounded-2xl border border-[#F3A5A5] bg-[#FEF2F2] p-6"}`} role="alert">
      <p className="text-sm font-semibold text-[#B91C1C]">Could not load the statistics</p>
      <p className="mt-1 text-xs text-[#625E6B]">{error.message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {needsSignIn && (
          <Button onClick={() => void beginSignIn()} variant="secondary">
            Sign in again
          </Button>
        )}
        <Button onClick={onRetry} variant="secondary">Try again</Button>
      </div>
    </div>
  )
}
