import { useState } from 'react'
import { cn } from '../lib/cn'
import { apiForgotPassword, apiResetPassword } from '../lib/authApi'

type AuthView = 'login' | 'register' | 'forgot' | 'reset'

type AuthPageProps = {
  initialView?: AuthView
  resetToken?: string | null
  onLogin: (email: string, password: string) => Promise<{ ok: boolean; detail?: string }>
  onRegister: (email: string, password: string, name: string) => Promise<{ ok: boolean; detail?: string }>
}

export function AuthPage({ initialView = 'login', resetToken, onLogin, onRegister }: AuthPageProps) {
  const [view, setView] = useState<AuthView>(resetToken ? 'reset' : initialView)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Please enter email and password')
      return
    }
    setSubmitting(true)
    const res = await onLogin(email.trim(), password)
    setSubmitting(false)
    if (!res.ok) setError(res.detail ?? 'Login failed')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Please enter email and password')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    const res = await onRegister(email.trim(), password, name.trim())
    setSubmitting(false)
    if (!res.ok) setError(res.detail ?? 'Registration failed')
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }
    setSubmitting(true)
    const res = await apiForgotPassword(email.trim())
    setSubmitting(false)
    if (res.ok) {
      setSuccess('If an account exists with that email, a reset link has been sent.')
    } else {
      setError('Something went wrong. Please try again.')
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!resetToken) {
      setError('Invalid reset link')
      return
    }
    setSubmitting(true)
    const res = await apiResetPassword(resetToken, password)
    setSubmitting(false)
    if (res.ok) {
      setSuccess('Password updated! You can now log in.')
      setTimeout(() => {
        setView('login')
        setSuccess(null)
        setPassword('')
        setConfirmPassword('')
      }, 2000)
    } else {
      setError(res.detail ?? 'Reset failed. The link may have expired.')
    }
  }

  const switchView = (next: AuthView) => {
    setView(next)
    setError(null)
    setSuccess(null)
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md">
        {/* Logo / branding */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            GT · Grounded Theory
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {view === 'login' && 'Sign in to your account'}
            {view === 'register' && 'Create a new account'}
            {view === 'forgot' && 'Reset your password'}
            {view === 'reset' && 'Set a new password'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* ── Login ──────────────────────────── */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <InputField
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="your@email.com"
                autoComplete="email"
              />
              <InputField
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete="current-password"
              />

              {error && <ErrorBanner message={error} />}

              <SubmitButton label="Sign in" loading={submitting} />

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => switchView('forgot')}
                  className="underline hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => switchView('register')}
                  className="underline hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Create account
                </button>
              </div>
            </form>
          )}

          {/* ── Register ──────────────────────── */}
          {view === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <InputField
                label="Name"
                type="text"
                value={name}
                onChange={setName}
                placeholder="Your name"
                autoComplete="name"
              />
              <InputField
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="your@email.com"
                autoComplete="email"
              />
              <InputField
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
              <InputField
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repeat password"
                autoComplete="new-password"
              />

              {error && <ErrorBanner message={error} />}

              <SubmitButton label="Create account" loading={submitting} />

              <div className="text-center text-xs text-slate-500 dark:text-slate-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchView('login')}
                  className="underline hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Sign in
                </button>
              </div>
            </form>
          )}

          {/* ── Forgot password ───────────────── */}
          {view === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <InputField
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="your@email.com"
                autoComplete="email"
              />

              {error && <ErrorBanner message={error} />}
              {success && <SuccessBanner message={success} />}

              <SubmitButton label="Send reset link" loading={submitting} />

              <div className="text-center text-xs text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => switchView('login')}
                  className="underline hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {/* ── Reset password ────────────────── */}
          {view === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <InputField
                label="New password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
              <InputField
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repeat password"
                autoComplete="new-password"
              />

              {error && <ErrorBanner message={error} />}
              {success && <SuccessBanner message={success} />}

              <SubmitButton label="Reset password" loading={submitting} />

              <div className="text-center text-xs text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => switchView('login')}
                  className="underline hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared sub-components ────────────────────────────────────

function InputField({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </div>
  )
}

function SubmitButton({ label, loading }: { label: string; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={cn(
        'w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition dark:bg-slate-100 dark:text-slate-900',
        loading
          ? 'cursor-wait opacity-70'
          : 'hover:bg-slate-800 dark:hover:bg-white',
      )}
    >
      {loading ? 'Please wait…' : label}
    </button>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
      {message}
    </div>
  )
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
      {message}
    </div>
  )
}
