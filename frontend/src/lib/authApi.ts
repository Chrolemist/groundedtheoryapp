export type AuthUser = {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
}

export type AuthState = {
  user: AuthUser | null
  token: string | null
}

const AUTH_STORAGE_KEY = 'gt-auth'

function getApiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
  if (configured) return configured.replace(/\/$/, '')
  if (typeof window !== 'undefined' && window.location.port === '5173')
    return 'http://localhost:8000'
  return typeof window !== 'undefined' ? window.location.origin : ''
}

async function authFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const base = getApiBase()
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

async function authFetchWithToken(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const base = getApiBase()
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
}

// ─── Public auth ─────────────────────────────────────────────
export async function apiRegister(
  email: string,
  password: string,
  name: string,
): Promise<{ ok: boolean; token?: string; user?: AuthUser; detail?: string }> {
  const res = await authFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, detail: data.detail ?? 'Registration failed' }
  }
  return res.json()
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<{ ok: boolean; token?: string; user?: AuthUser; detail?: string }> {
  const res = await authFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, detail: data.detail ?? 'Login failed' }
  }
  return res.json()
}

export async function apiForgotPassword(
  email: string,
): Promise<{ ok: boolean; message?: string }> {
  const res = await authFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
  return res.json()
}

export async function apiResetPassword(
  token: string,
  password: string,
): Promise<{ ok: boolean; message?: string; detail?: string }> {
  const res = await authFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, detail: data.detail ?? 'Reset failed' }
  }
  return res.json()
}

export async function apiGetMe(
  token: string,
): Promise<AuthUser | null> {
  try {
    const res = await authFetchWithToken('/auth/me', token)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ─── Admin user management ───────────────────────────────────
export async function apiAdminListUsers(
  token: string,
): Promise<{ users: AuthUser[] }> {
  const res = await authFetchWithToken('/admin/users', token)
  if (!res.ok) throw new Error('Failed to list users')
  return res.json()
}

export async function apiAdminCreateUser(
  token: string,
  data: { email: string; password: string; name: string },
): Promise<{ ok: boolean; user?: AuthUser; detail?: string }> {
  const res = await authFetchWithToken('/admin/users', token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    return { ok: false, detail: d.detail ?? 'Failed to create user' }
  }
  return res.json()
}

export async function apiAdminUpdateUser(
  token: string,
  userId: string,
  data: { name?: string; email?: string; role?: string; password?: string },
): Promise<{ ok: boolean; detail?: string }> {
  const res = await authFetchWithToken(`/admin/users/${userId}`, token, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    return { ok: false, detail: d.detail ?? 'Failed to update user' }
  }
  return res.json()
}

export async function apiAdminDeleteUser(
  token: string,
  userId: string,
): Promise<{ ok: boolean; detail?: string }> {
  const res = await authFetchWithToken(`/admin/users/${userId}`, token, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    return { ok: false, detail: d.detail ?? 'Failed to delete user' }
  }
  return res.json()
}

// ─── Local persistence ───────────────────────────────────────
export function saveAuthToStorage(state: AuthState): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export function loadAuthFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return { user: null, token: null }
    return JSON.parse(raw) as AuthState
  } catch {
    return { user: null, token: null }
  }
}

export function clearAuthStorage(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // ignore
  }
}
