import { useEffect, useRef } from 'react'
import { cn } from '../lib/cn'

type AdminLoginModalProps = {
  open: boolean
  password: string
  isSubmitting: boolean
  error: string | null
  retryAfterSeconds?: number | null
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  onClose: () => void
}

export function AdminLoginModal({
  open,
  password,
  isSubmitting,
  error,
  retryAfterSeconds,
  onPasswordChange,
  onSubmit,
  onClose,
}: AdminLoginModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 px-4 py-6">
      <div className="mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Admin login</h2>
            <p className="text-sm text-slate-500">Enter the admin password to unlock protected actions.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500"
          >
            Close
          </button>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Password
            </label>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="Admin password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
              {typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0 ? (
                <div className="mt-1 text-[11px] text-rose-600">
                  Remaining: {retryAfterSeconds}s
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>3 failed attempts triggers a timed lockout.</span>
            <button
              type="submit"
              className={cn(
                'rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white',
                isSubmitting ? 'cursor-wait opacity-70' : 'hover:bg-slate-800',
              )}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Checking...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
