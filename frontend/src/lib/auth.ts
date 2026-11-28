import { config } from "@/lib/config"

type CognitoTokenSet = {
  accessToken: string
  idToken: string
  refreshToken: string
  expiresAt: number
}

type TokenResponse = {
  access_token?: string
  id_token?: string
  expires_in?: number
  refresh_token?: string
  error?: string
  error_description?: string
}

const TOKEN_KEY = "csep.tokens"
const VERIFIER_KEY = "csep.pkce.verifier"
const STATE_KEY = "csep.oauth.state"
const REFRESH_SKEW_MS = 60_000

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthenticationError"
  }
}

let refreshInFlight: Promise<CognitoTokenSet> | null = null

function randomValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function readTokens(): CognitoTokenSet | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CognitoTokenSet>
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.idToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      sessionStorage.removeItem(TOKEN_KEY)
      return null
    }
    return parsed as CognitoTokenSet
  } catch {
    return null
  }
}

function persistTokens(tokens: CognitoTokenSet): CognitoTokenSet {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
  return tokens
}

function saveTokenResponse(
  response: TokenResponse,
  previous?: CognitoTokenSet,
): CognitoTokenSet {
  if (!response.access_token || !response.id_token || !response.expires_in) {
    throw new AuthenticationError("Cognito returned an incomplete token response.")
  }

  // With refresh-token rotation enabled, Cognito returns a replacement refresh
  // token. Never silently reuse an old token when rotation is expected.
  const refreshToken = response.refresh_token
  if (!refreshToken && !previous?.refreshToken) {
    throw new AuthenticationError("Cognito did not return a refresh token.")
  }

  return persistTokens({
    accessToken: response.access_token,
    idToken: response.id_token,
    refreshToken: refreshToken ?? previous!.refreshToken,
    expiresAt: Date.now() + response.expires_in * 1000,
  })
}

async function tokenRequest(form: URLSearchParams): Promise<TokenResponse> {
  let response: Response
  try {
    response = await fetch(`${config.cognitoDomain}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    })
  } catch {
    throw new AuthenticationError("Could not reach Cognito. Check your connection.")
  }

  const payload = (await response.json().catch(() => ({}))) as TokenResponse
  if (!response.ok) {
    throw new AuthenticationError(
      payload.error_description ?? payload.error ?? "Cognito token exchange failed.",
    )
  }
  return payload
}

export async function beginSignIn(): Promise<void> {
  const verifier = randomValue()
  const state = randomValue()
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  )
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)

  const url = new URL(`${config.cognitoDomain}/oauth2/authorize`)
  url.search = new URLSearchParams({
    client_id: config.cognitoClientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: config.redirectUri,
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  }).toString()

  window.location.assign(url.toString())
}

export async function initializeAuth(): Promise<boolean> {
  const query = new URLSearchParams(window.location.search)
  const oauthError = query.get("error")
  const code = query.get("code")

  if (oauthError) {
    window.history.replaceState({}, "", config.redirectUri)
    throw new AuthenticationError(
      query.get("error_description") ?? oauthError,
    )
  }

  if (code) {
    const expectedState = sessionStorage.getItem(STATE_KEY)
    const actualState = query.get("state")
    const verifier = sessionStorage.getItem(VERIFIER_KEY)

    window.history.replaceState({}, "", config.redirectUri)
    sessionStorage.removeItem(STATE_KEY)
    sessionStorage.removeItem(VERIFIER_KEY)

    if (!expectedState || actualState !== expectedState || !verifier) {
      throw new AuthenticationError("The Cognito sign-in response could not be verified.")
    }

    const result = await tokenRequest(
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.cognitoClientId,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: verifier,
      }),
    )
    saveTokenResponse(result)
    return true
  }

  const tokens = readTokens()
  if (!tokens) return false

  await getIdToken()
  return true
}

/**
 * Single-flight refresh. All callers share one refresh request. A caller that
 * received 401 with an older token reuses a newer token already saved by
 * another request instead of rotating the refresh token again.
 */
export async function refreshIdToken(rejectedToken?: string): Promise<string> {
  const current = readTokens()
  if (current && rejectedToken && current.idToken !== rejectedToken) {
    return current.idToken
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const previous = readTokens()
      if (!previous?.refreshToken) {
        throw new AuthenticationError("Your session has expired. Sign in again.")
      }

      const result = await tokenRequest(
        new URLSearchParams({
          grant_type: "refresh_token",
          client_id: config.cognitoClientId,
          refresh_token: previous.refreshToken,
        }),
      )
      return saveTokenResponse(result, previous)
    })().finally(() => {
      refreshInFlight = null
    })
  }

  const refreshed = await refreshInFlight
  return refreshed.idToken
}

export async function getIdToken(): Promise<string> {
  const tokens = readTokens()
  if (!tokens) throw new AuthenticationError("Sign in is required.")

  if (tokens.expiresAt <= Date.now() + REFRESH_SKEW_MS) {
    return refreshIdToken(tokens.idToken)
  }
  return tokens.idToken
}

export const getAccessToken = getIdToken

export function signOut(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)

  const url = new URL(`${config.cognitoDomain}/logout`)
  url.search = new URLSearchParams({
    client_id: config.cognitoClientId,
    logout_uri: config.redirectUri,
  }).toString()
  window.location.assign(url.toString())
}
