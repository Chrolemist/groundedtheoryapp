import { useMemo } from 'react'
import { DashboardLayout } from './components/DashboardLayout'
import { AuthPage } from './components/AuthPage'
import { useAuth } from './hooks/useAuth'

function App() {
  const auth = useAuth()

  // Check for password-reset token in URL
  const resetToken = useMemo(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('reset_token') ?? null
  }, [])

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    )
  }

  if (!auth.isAuthenticated || resetToken) {
    return (
      <AuthPage
        resetToken={resetToken}
        onLogin={auth.login}
        onRegister={auth.register}
      />
    )
  }

  return (
    <DashboardLayout
      authUser={auth.user}
      authToken={auth.token}
      onLogout={auth.logout}
    />
  )
}

export default App
