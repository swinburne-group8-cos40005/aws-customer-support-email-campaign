/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Invoke URL of the HTTP API, e.g. https://abc123.execute-api.ap-southeast-1.amazonaws.com (csep-api FrontendConfig.apiBaseUrl). */
  readonly VITE_API_BASE_URL?: string
  /** Optional Cognito ID token for local development only; the real token comes from the sign-in flow. */
  readonly VITE_DEV_ID_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
