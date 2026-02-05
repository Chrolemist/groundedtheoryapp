import { useState } from 'react'

const STORAGE_KEY = 'grounded-ai-tour-seen'

const getStoredSeen = () => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export function useOnboardingTour() {
  const [run, setRun] = useState(() => !getStoredSeen())

  const restart = () => {
    localStorage.removeItem(STORAGE_KEY)
    setRun(true)
  }

  const stop = () => {
    setRun(false)
  }

  return { run, restart, stop }
}
