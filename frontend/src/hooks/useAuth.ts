import { useCallback, useEffect, useState } from 'react'
import type { AuthUser } from '../lib/authApi'
import {
  apiGetMe,
  apiLogin,
  apiRegister,
  clearAuthStorage,
  loadAuthFromStorage,
  saveAuthToStorage,
} from '../lib/authApi'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
    clearAuthStorage()
  }, [])

  return {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
  }
}
