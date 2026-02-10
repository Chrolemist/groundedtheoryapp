export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'gt-theme'

const prefersDark = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

export const getThemePreference = (): ThemePreference => {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    // ignore
  }
  return 'system'
}

export const getResolvedTheme = (): 'light' | 'dark' => {
  const preference = getThemePreference()
  if (preference === 'dark') return 'dark'
  if (preference === 'light') return 'light'
  return prefersDark() ? 'dark' : 'light'
}

export const applyTheme = () => {
  if (typeof document === 'undefined') return
  const resolved = getResolvedTheme()
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export const setThemePreference = (preference: ThemePreference) => {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // ignore
  }
  applyTheme()
}

export const toggleTheme = () => {
  const resolved = getResolvedTheme()
  setThemePreference(resolved === 'dark' ? 'light' : 'dark')
}

export const initTheme = () => {
  applyTheme()

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = () => {
    if (getThemePreference() !== 'system') return
    applyTheme()
  }

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }

  media.addListener(handleChange)
  return () => {
    media.removeListener(handleChange)
  }
}
