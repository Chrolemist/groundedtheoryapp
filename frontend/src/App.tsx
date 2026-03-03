import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from './components/DashboardLayout'
import { AuthPage } from './components/AuthPage'
import { useAuth } from './hooks/useAuth'

function App() {
  const auth = useAuth()
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Check for password-reset token in URL
  const resetToken = useMemo(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('reset_token') ?? null
  }, [])

  // Check for invite token in URL
  const inviteToken = useMemo(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('invite_token') ?? null
  }, [])

  // Automatically redeem invite token on mount
  useEffect(() => {
    if (!inviteToken || auth.loading) return
    // Already authenticated? Skip redeem – just strip the param
    if (auth.isAuthenticated) {
      const url = new URL(window.location.href)
      url.searchParams.delete('invite_token')
      window.history.replaceState({}, '', url.toString())
      return
    }
    auth.redeemInvite(inviteToken).then((res) => {
      // Strip the invite_token from URL after redemption
      const url = new URL(window.location.href)
      url.searchParams.delete('invite_token')
      window.history.replaceState({}, '', url.toString())
      if (!res.ok) {
        setInviteError(res.detail ?? 'Invalid or expired invite link')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken, auth.loading])

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
        onGuestLogin={auth.loginAsGuest}
        inviteError={inviteError}
      />
    )
  }

  return (
    <DashboardLayout
      authUser={auth.user}
      authToken={auth.token}
      onLogout={auth.logout}
      inviteProjectId={auth.inviteProjectId}
    />
  )
}

export default App
