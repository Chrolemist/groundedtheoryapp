import { useCallback, useEffect, useState } from 'react'
import type { AuthUser } from '../lib/authApi'
import {
  apiGetMe,
  apiLogin,
  apiRegister,
  apiRedeemInvite,
  clearAuthStorage,
  loadAuthFromStorage,
  saveAuthToStorage,
} from '../lib/authApi'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteProjectId, setInviteProjectId] = useState<string | null>(null)

  // Restore session on mount
  useEffect(() => {
    let cancelled = false
    const stored = loadAuthFromStorage()
    if (stored.token) {
      apiGetMe(stored.token).then((me) => {
        if (cancelled) return
        if (me) {
          setUser(me)
          setToken(stored.token)
        } else {
          clearAuthStorage()
        }
        setLoading(false)
      })
    } else {
      // Use microtask to avoid synchronous setState in effect body
      queueMicrotask(() => {
        if (!cancelled) setLoading(false)
      })
    }
    return () => { cancelled = true }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiLogin(email, password)
      if (res.ok && res.token && res.user) {
        setUser(res.user)
        setToken(res.token)
        saveAuthToStorage({ user: res.user, token: res.token })
        return { ok: true as const }
      }
      return { ok: false as const, detail: res.detail ?? 'Login failed' }
    },
    [],
  )

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await apiRegister(email, password, name)
      if (res.ok && res.token && res.user) {
        setUser(res.user)
        setToken(res.token)
        saveAuthToStorage({ user: res.user, token: res.token })
        return { ok: true as const }
      }
      return { ok: false as const, detail: res.detail ?? 'Registration failed' }
    },
    [],
  )

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    setInviteProjectId(null)
    clearAuthStorage()
  }, [])

  const redeemInvite = useCallback(
    async (inviteToken: string) => {
      const res = await apiRedeemInvite(inviteToken)
      if (res.ok && res.token && res.user && res.project_id) {
        setUser(res.user)
        setToken(res.token)
        setInviteProjectId(res.project_id)
        // Don't persist guest sessions to localStorage
        return { ok: true as const, projectId: res.project_id }
      }
      return { ok: false as const, detail: res.detail ?? 'Invalid invite link' }
    },
    [],
  )

  return {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    isAdmin: user?.role === 'admin',
    isGuest: user?.role === 'guest',
    inviteProjectId,
    login,
    register,
    logout,
    redeemInvite,
  }
}
