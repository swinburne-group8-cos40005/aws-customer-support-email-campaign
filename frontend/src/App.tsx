import { useState } from "react"
import { LoginPage } from "@/pages/LoginPage"
import { Workspace } from "@/Workspace"

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const toggleTheme = () => setDarkMode((value) => !value)

  return loggedIn ? (
    <Workspace
      darkMode={darkMode}
      onLogout={() => setLoggedIn(false)}
      onToggleTheme={toggleTheme}
    />
  ) : (
    <LoginPage
      darkMode={darkMode}
      onLogin={() => setLoggedIn(true)}
      onToggleTheme={toggleTheme}
    />
  )
}
