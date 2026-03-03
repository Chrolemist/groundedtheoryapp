import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { cn } from '../lib/cn'
import type { AuthUser } from '../lib/authApi'
import {
  apiAdminListUsers,
  apiAdminCreateUser,
  apiAdminUpdateUser,
  apiAdminDeleteUser,
} from '../lib/authApi'

type AdminUsersPanelProps = {
  open: boolean
  token: string
  onClose: () => void
}

type EditingUser = {
  id?: string
  email: string
  name: string
  role: string
  password: string
}

export function AdminUsersPanel({ open, token, onClose }: AdminUsersPanelProps) {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingUser | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiAdminListUsers(token)
      setUsers(res.users ?? [])
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const handleDelete = async (userId: string, email: string) => {
    if (!window.confirm(`Delete user "${email}" permanently?`)) return
    const res = await apiAdminDeleteUser(token, userId)
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } else {
      setError(res.detail ?? 'Failed to delete user')
    }
  }

  const handleSave = async () => {
    if (!editing) return
    setEditError(null)
    setSaving(true)

    if (editing.id) {
      // Update existing
      const updates: Record<string, string> = {}
      if (editing.name) updates.name = editing.name
      if (editing.email) updates.email = editing.email
      if (editing.role) updates.role = editing.role
      if (editing.password) updates.password = editing.password
      const res = await apiAdminUpdateUser(token, editing.id, updates)
      setSaving(false)
      if (res.ok) {
        setEditing(null)
        void refresh()
      } else {
        setEditError(res.detail ?? 'Failed to update')
      }
    } else {
      // Create new
      if (!editing.email || !editing.password) {
        setEditError('Email and password are required')
        setSaving(false)
        return
      }
      const res = await apiAdminCreateUser(token, {
        email: editing.email,
        password: editing.password,
        name: editing.name,
      })
      setSaving(false)
      if (res.ok) {
        setEditing(null)
        void refresh()
      } else {
        setEditError(res.detail ?? 'Failed to create user')
      }
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 px-4 py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            User management
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing({
                  email: '',
                  name: '',
                  role: 'user',
                  password: '',
                })
                setEditError(null)
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Plus className="h-3.5 w-3.5" />
              New user
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Edit/Create form */}
        {editing && (
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
              {editing.id ? 'Edit user' : 'Create new user'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Name"
                value={editing.name}
                onChange={(e) =>
                  setEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="email"
                placeholder="Email"
                value={editing.email}
                onChange={(e) =>
                  setEditing((prev) => (prev ? { ...prev, email: e.target.value } : prev))
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="password"
                placeholder={editing.id ? 'New password (leave blank to keep)' : 'Password'}
                value={editing.password}
                onChange={(e) =>
                  setEditing((prev) => (prev ? { ...prev, password: e.target.value } : prev))
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <select
                value={editing.role}
                onChange={(e) =>
                  setEditing((prev) => (prev ? { ...prev, role: e.target.value } : prev))
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {editError && (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{editError}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  'rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900',
                  saving ? 'cursor-wait opacity-70' : 'hover:bg-slate-800 dark:hover:bg-white',
                )}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(null)
                  setEditError(null)
                }}
                className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* User list */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {error && (
            <p className="mb-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>
          )}
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-slate-500">No users found</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-slate-50 dark:border-slate-800/50"
                  >
                    <td className="py-2 text-slate-900 dark:text-slate-100">
                      {u.name || '—'}
                    </td>
                    <td className="py-2 text-slate-600 dark:text-slate-400">{u.email}</td>
                    <td className="py-2">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          u.role === 'admin'
                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                        )}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing({
                            id: u.id,
                            email: u.email,
                            name: u.name,
                            role: u.role,
                            password: '',
                          })
                          setEditError(null)
                        }}
                        className="mr-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(u.id, u.email)}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
