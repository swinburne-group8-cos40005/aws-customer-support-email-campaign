/**
 * Central ID-token provider for API requests.
 *
 * Cognito ID tokens carry the app-client audience required by the API authorizer.
 */

export type IdTokenProvider = () => Promise<string | null>;

let idTokenProvider: IdTokenProvider | null = null;

export function registerIdTokenProvider(provider: IdTokenProvider): void {
  idTokenProvider = provider;
}

export async function getIdToken(): Promise<string | null> {
  if (!idTokenProvider) {
    return null;
  }

  return idTokenProvider();
}
