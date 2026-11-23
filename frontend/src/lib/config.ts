function required(value:string | undefined, name: string): string {
    if (!value) throw new Error(`Missing ${name}. Copy it from FrontendConfig into frontend/.env.local.`)
    return value
}

export const config = {
    cognitoClientId: required(import.meta.env.VITE_COGNITO_CLIENT_ID, "VITE_COGNITO_CLIENT_ID"),
    cognitoDomain: required(import.meta.env.VITE_COGNITO_DOMAIN, "VITE_COGNITO_DOMAIN").replace(/\/+$/, ""),
    apiBaseUrl: required(import.meta.env.VITE_API_BASE_URL, "VITE_API_BASE_URL").replace(/\/+$/, ""),
    redirectUri: `${window.location.origin}`,
}