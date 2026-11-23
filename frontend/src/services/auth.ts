/**
 * Central access-token provider.
 *
 * Cognito integration can register a provider when it becomes available.
 * Until then, API mode will report that authentication is unavailable.
 */

export type AccessTokenProvider = () => Promise<string | null>;

let accessTokenProvider: AccessTokenProvider | null = null;

export function registerAccessTokenProvider(
  provider: AccessTokenProvider
): void {
  accessTokenProvider = provider;
}

export async function getAccessToken(): Promise<string | null> {
  if (!accessTokenProvider) {
    return null;
  }

  return accessTokenProvider();
}
