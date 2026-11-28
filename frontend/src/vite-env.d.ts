/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cognito user pool ID exported by csep-auth (for example ap-southeast-2_abc123). */
  readonly VITE_COGNITO_USER_POOL_ID?: string
  /** Public Cognito app client ID exported by csep-auth. */
  readonly VITE_COGNITO_CLIENT_ID?: string
  /** Cognito domain used by the OAuth refresh-token endpoint. */
  readonly VITE_COGNITO_DOMAIN?: string
  /** Invoke URL of the HTTP API, e.g. https://abc123.execute-api.ap-southeast-1.amazonaws.com (csep-api FrontendConfig.apiBaseUrl). */
  readonly VITE_API_BASE_URL?: string
  /** Optional Cognito ID token for local development only; the real token comes from the sign-in flow. */
  readonly VITE_DEV_ID_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
