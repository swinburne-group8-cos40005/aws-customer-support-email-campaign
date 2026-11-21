import { useState } from "react"
import { setIdToken, type ApiRequestError } from "@/api/client"
import { Button } from "@/components/ui/Button"

/**
 * Error panel with a retry. For 401s it offers a way to supply a Cognito
 * ID token, because the sign-in screen is still a prototype: the token is
 * kept in sessionStorage only and is gone when the tab closes.
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
  const [token, setToken] = useState("")
  const needsToken = error.status === 401 || error.status === 403

  return (
    <div className={`${compact ? "px-6 py-6" : "mt-8 rounded-2xl border border-[#F3A5A5] bg-[#FEF2F2] p-6"}`} role="alert">
      <p className="text-sm font-semibold text-[#B91C1C]">Could not load the statistics</p>
      <p className="mt-1 text-xs text-[#625E6B]">{error.message}</p>
      {needsToken && (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            setIdToken(token.trim() || null)
            setToken("")
            onRetry()
          }}
        >
          <input
            aria-label="Cognito ID token"
            className="field"
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste a Cognito ID token"
            type="password"
            value={token}
          />
          <Button className="shrink-0" type="submit" variant="secondary">
            Use token
          </Button>
        </form>
      )}
      <div className="mt-4">
        <Button onClick={onRetry} variant="secondary">
          Try again
        </Button>
      </div>
    </div>
  )
}
