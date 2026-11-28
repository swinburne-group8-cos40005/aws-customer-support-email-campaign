import {
    AuthenticationDetails,
    CognitoUser,
    CognitoUserAttribute,
    CognitoUserPool,
    type CognitoUserSession,
} from "amazon-cognito-identity-js"
import { config } from "@/lib/config"

type TokenSet = {
    accessToken: string
    idToken: string
    refreshToken: string
    expiresAt: number
}

type TokenResponse = {
    access_token: string
    id_token: string
    expires_in: number
    refresh_token?: string
    error?: string
    error_description?: string
}

const TOKEN_KEY = "csep.tokens"
const ID_TOKEN_KEY = "csep.idToken"
const userPool = new CognitoUserPool({
    UserPoolId: config.cognitoUserPoolId,
    ClientId: config.cognitoClientId,
    Storage: sessionStorage,
})

export class AuthenticationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "AuthenticationError"
    }
}

function cognitoUser(email: string): CognitoUser {
    return new CognitoUser({
        Username: email,
        Pool: userPool,
        Storage: sessionStorage,
    })
}

function readTokens(): TokenSet | null {
    const value = sessionStorage.getItem(TOKEN_KEY)
    if (!value) return null

    try {
        const tokens = JSON.parse(value) as Partial<TokenSet>
        if (
            typeof tokens.accessToken === "string" &&
            typeof tokens.idToken === "string" &&
            typeof tokens.refreshToken === "string" &&
            typeof tokens.expiresAt === "number" &&
            Number.isFinite(tokens.expiresAt)
        ) {
            return {
                accessToken: tokens.accessToken,
                idToken: tokens.idToken,
                refreshToken: tokens.refreshToken,
                expiresAt: tokens.expiresAt,
            }
        }
    } catch {
        // Clear malformed or obsolete session data below.
    }

    clearTokens()
    return null
}

function clearTokens(): void {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(ID_TOKEN_KEY)
}

function saveTokens(response: TokenResponse, previous?: TokenSet): TokenSet {
    if (
        !response.access_token ||
        !response.id_token ||
        !Number.isFinite(response.expires_in) ||
        response.expires_in <= 0
    ) {
        throw new AuthenticationError("Cognito returned an incomplete token response.")
    }

    const tokens: TokenSet = {
        accessToken: response.access_token,
        idToken: response.id_token,
        refreshToken: response.refresh_token ?? previous?.refreshToken ?? "",
        expiresAt: Date.now() + response.expires_in * 1000,
    }

    if (!tokens.refreshToken) {
        throw new AuthenticationError("Cognito did not return a refresh token.")
    }

    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
    sessionStorage.setItem(ID_TOKEN_KEY, tokens.idToken)
    return tokens
}

function saveSession(session: CognitoUserSession): void {
    saveTokens({
        access_token: session.getAccessToken().getJwtToken(),
        id_token: session.getIdToken().getJwtToken(),
        expires_in: session.getAccessToken().getExpiration() - Math.floor(Date.now() / 1000),
        refresh_token: session.getRefreshToken().getToken(),
    })
}

function authenticationError(cause: unknown): AuthenticationError {
    const error =
        cause !== null && typeof cause === "object"
            ? (cause as { code?: string; message?: string })
            : {}
    const messages: Record<string, string> = {
        CodeMismatchException: "That verification code is incorrect. Check the email and try again.",
        ExpiredCodeException: "That verification code has expired. Request a new code.",
        InvalidParameterException: "Check the email, password, and verification code, then try again.",
        InvalidPasswordException:
            "Choose a password with at least 12 characters, including uppercase, lowercase, a number, and a symbol.",
        LimitExceededException: "Too many attempts. Wait a while before trying again.",
        NotAuthorizedException: "The email or password is incorrect.",
        PasswordResetRequiredException:
            "Your account needs a password reset before you can sign in. Contact your administrator.",
        TooManyRequestsException: "Too many attempts. Wait a while before trying again.",
        UserNotConfirmedException: "Confirm your email address before signing in.",
        UserNotFoundException: "The email or password is incorrect.",
        UsernameExistsException: "An account with this email already exists. Sign in instead.",
    }

    return new AuthenticationError(
        (error.code && messages[error.code]) ||
            error.message ||
            "Cognito could not complete the request. Please try again.",
    )
}

export function signIn(email: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
        cognitoUser(email).authenticateUser(
            new AuthenticationDetails({ Username: email, Password: password }),
            {
                onSuccess: (session) => {
                    try {
                        saveSession(session)
                        resolve()
                    } catch (cause) {
                        reject(cause)
                    }
                },
                onFailure: (cause) => reject(authenticationError(cause)),
                newPasswordRequired: () =>
                    reject(
                        new AuthenticationError(
                            "Your account requires a password update before you can sign in. Contact your administrator.",
                        ),
                    ),
                mfaRequired: () =>
                    reject(
                        new AuthenticationError(
                            "This account requires multi-factor authentication, which is not enabled for this app.",
                        ),
                    ),
                totpRequired: () =>
                    reject(
                        new AuthenticationError(
                            "This account requires multi-factor authentication, which is not enabled for this app.",
                        ),
                    ),
                customChallenge: () =>
                    reject(
                        new AuthenticationError(
                            "This account requires an unsupported sign-in challenge. Contact your administrator.",
                        ),
                    ),
            },
        )
    })
}

export function signUp(email: string, password: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        userPool.signUp(
            email,
            password,
            [new CognitoUserAttribute({ Name: "email", Value: email })],
            [],
            (cause, result) => {
                if (cause) {
                    reject(authenticationError(cause))
                    return
                }
                if (!result) {
                    reject(new AuthenticationError("Cognito did not return a registration result."))
                    return
                }
                resolve(result.userConfirmed)
            },
        )
    })
}

export function confirmSignUp(email: string, code: string): Promise<void> {
    return new Promise((resolve, reject) => {
        cognitoUser(email).confirmRegistration(code, true, (cause) => {
            if (cause) {
                reject(authenticationError(cause))
                return
            }
            resolve()
        })
    })
}

export function resendConfirmationCode(email: string): Promise<void> {
    return new Promise((resolve, reject) => {
        cognitoUser(email).resendConfirmationCode((cause) => {
            if (cause) {
                reject(authenticationError(cause))
                return
            }
            resolve()
        })
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
        throw new AuthenticationError("Could not reach Cognito. Check your connection and retry.")
    }

    let payload: TokenResponse
    try {
        payload = (await response.json()) as TokenResponse
    } catch {
        throw new AuthenticationError("Cognito returned an unreadable token response.")
    }

    if (!response.ok) {
        throw new AuthenticationError(
            payload.error_description ?? payload.error ?? "Cognito token refresh failed.",
        )
    }
    return payload
}

export async function initializeAuth(): Promise<boolean> {
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

export async function getAccessToken(): Promise<string | null> {
    let tokens = readTokens()
    if (!tokens) return null

    if (tokens.expiresAt <= Date.now() + 60_000) {
        await refreshAccessToken()
        tokens = readTokens()
    }
    return tokens?.accessToken ?? null
}

export async function getIdToken(): Promise<string | null> {
    let tokens = readTokens()
    if (!tokens) return null

    if (tokens.expiresAt <= Date.now() + 60_000) {
        await refreshAccessToken()
        tokens = readTokens()
    }
    return tokens?.idToken ?? null
}

export function signOut(): void {
    userPool.getCurrentUser()?.signOut()
    clearTokens()
}
