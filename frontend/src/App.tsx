import { useEffect, useState } from "react"
import { LoginPage } from "@/pages/LoginPage"
import { Workspace } from "@/Workspace"
import {
  confirmSignUp,
  getIdToken,
  initializeAuth,
  resendConfirmationCode,
  signIn,
  signOut,
  signUp,
} from "@/lib/auth"
import { registerIdTokenProvider } from "@/services/auth"

let authInitialization: Promise<boolean> | undefined
registerIdTokenProvider(getIdToken)

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    authInitialization ??= initializeAuth()
    let active = true

    authInitialization
      .then((authenticated) => {
        if (active) setLoggedIn(authenticated)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(cause instanceof Error ? cause.message : "Sign-in failed.")
        setLoggedIn(false)
      })

    return () => {
      active = false
    }
  }, [])

  const toggleTheme = () => setDarkMode((value) => !value)

  if (loggedIn === null) {
    return <main className="p-8 text-sm text-[#625E6B]">Checking sign-in...</main>
  }

  return loggedIn ? (
    <Workspace
      darkMode={darkMode}
      onLogout={signOut}
      onToggleTheme={toggleTheme}
    />
  ) : (
    <LoginPage
      darkMode={darkMode}
      error={error}
      onSignIn={async (email, password) => {
        setError("")
        await signIn(email, password)
        setLoggedIn(true)
      }}
      onSignUp={signUp}
      onConfirmSignUp={confirmSignUp}
      onResendConfirmationCode={resendConfirmationCode}
      onToggleTheme={toggleTheme}
    />
  )
}
