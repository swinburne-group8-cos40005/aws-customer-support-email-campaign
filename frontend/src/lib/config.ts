function required(value:string | undefined, name: string): string {
    if (!value) throw new Error(`Missing ${name}. Copy it from FrontendConfig into frontend/.env.local.`)
    return value
}

export const config = {
    cognitoClientId: required(import.meta.env.VITE_COGNITO_CLIENT_ID, "VITE_COGNITO_CLIENT_ID"),
    cognitoUserPoolId: required(import.meta.env.VITE_COGNITO_USER_POOL_ID, "VITE_COGNITO_USER_POOL_ID"),
    cognitoDomain: required(import.meta.env.VITE_COGNITO_DOMAIN, "VITE_COGNITO_DOMAIN").replace(/\/+$/, ""),
    apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, ""),
}