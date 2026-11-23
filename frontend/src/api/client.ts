/**
 * Minimal fetch wrapper for the Campaign API (docs/api-contract.md).
 * Every endpoint needs the Cognito ID token as a Bearer header (§1.1);
 * errors arrive in the standard envelope (§1.3) and are surfaced as
 * ApiRequestError so screens can show the server's own message.
 */

const TOKEN_KEY = "csep.idToken"

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.code = code
  }
}

export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "")
}

/** The Cognito ID token for this browser session (sessionStorage, then the dev env fallback). */
export function getIdToken(): string | null {
  try {
    const stored = sessionStorage.getItem(TOKEN_KEY)
    if (stored) return stored
  } catch {
    // Storage can be blocked (private mode); fall through to the env token.
  }
  return import.meta.env.VITE_DEV_ID_TOKEN || null
}

export function setIdToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing else to do: the user can still use VITE_DEV_ID_TOKEN.
  }
}

type ErrorEnvelope = { error?: { code?: string; message?: string } }

export async function apiGet<T>(
  path: string,
  options: { query?: Record<string, string | number | undefined>; signal?: AbortSignal } = {},
): Promise<T> {
  const token = getIdToken()
  if (!token) {
    throw new ApiRequestError(401, "UNAUTHENTICATED", "You are not signed in to the API.")
  }

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) params.set(key, String(value))
  }
  const serialized = params.toString()
  const queryString = serialized ? `?${serialized}` : ""

  let response: Response
  try {
    response = await fetch(`${getApiBaseUrl()}${path}${queryString}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: options.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err
    throw new ApiRequestError(0, "NETWORK_ERROR", "Could not reach the API. Check your connection and retry.")
  }

  if (!response.ok) {
    let envelope: ErrorEnvelope = {}
    try {
      envelope = (await response.json()) as ErrorEnvelope
    } catch {
      // API Gateway answers 401/403 with its own body, not our envelope.
    }
    throw new ApiRequestError(
      response.status,
      envelope.error?.code ?? `HTTP_${response.status}`,
      envelope.error?.message ??
        (response.status === 401
          ? "Your session is not authorised (token missing or expired)."
          : `Request failed with status ${response.status}.`),
    )
  }

  return (await response.json()) as T
}
