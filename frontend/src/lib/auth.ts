import { config } from "@/lib/config"

type TokenSet = {
    accessToken: string
    refreshToken: string
    expiresAt: number
}

type TokenResponse = {
    access_token: string
    expires_in: number
    refresh_token?: string
    error?: string
    error_description?: string
}

const TOKEN_KEY = "csep.tokens"
const VERIFIER_KEY = "csep.pkce.verifier"
const STATE_KEY = "csep.oauth.state"

export class AuthenticationError extends Error {}

function randomValue(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}

function readTokens(): TokenSet | null {
    const value = sessionStorage.getItem(TOKEN_KEY)
    if (!value) return null

    try {
        return JSON.parse(value) as TokenSet
    } catch {
        sessionStorage.removeItem(TOKEN_KEY)
        return null
    }
}

function saveTokens(response: TokenResponse, previous?: TokenSet): TokenSet {
    if (!response.access_token || !response.expires_in) {
        throw new AuthenticationError("Cognito returned an incomplete token response.")
    }

    const tokens: TokenSet = {
        accessToken: response.access_token,
        refreshToken: response.refresh_token ?? previous?.refreshToken ?? "",
        expiresAt: Date.now() + response.expires_in * 1000,
    }

    if (!tokens.refreshToken) {
        throw new AuthenticationError("Cognito did not return a refresh token.")
    }

    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
    return tokens
}

async function tokenRequest(form: URLSearchParams): Promise<TokenResponse> {
    const response = await fetch(`${config.cognitoDomain}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
    })

    const payload = (await response.json()) as TokenResponse
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
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier),)
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "-")
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
        throw new AuthenticationError(query.get("error_description") ?? oauthError,)
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
        saveTokens(result)
        return true
    }

    const tokens = readTokens()
    if (!tokens) return false

    if (tokens.expiresAt <= Date.now() + 60_000) {
        await refreshAccessToken()
    }
    return true
}

export async function refreshAccessToken(): Promise<string> {
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

    return saveTokens(result, previous).accessToken
}

export async function getAccessToken(): Promise<string> {
    const tokens = readTokens()
    if (!tokens) throw new AuthenticationError("Sign in is required.")

    if (tokens.expiresAt <= Date.now() + 60_000) {
        return refreshAccessToken()
    }
    return tokens.accessToken
}

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
