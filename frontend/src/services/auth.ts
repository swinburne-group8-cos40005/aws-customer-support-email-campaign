/** Compatibility exports: Cognito session ownership lives in lib/auth.ts. */
export {
  AuthenticationError,
  beginSignIn,
  initializeAuth,
  signOut,
  getIdToken,
  getAccessToken,
  refreshIdToken,
} from "@/lib/auth"
