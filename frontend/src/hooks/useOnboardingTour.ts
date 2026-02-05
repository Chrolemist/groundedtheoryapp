import { useState } from 'react'

const STORAGE_KEY = 'grounded-ai-tour-seen'

const getStoredSeen = () => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export function useOnboardingTour() {
  const [run, setRun] = useState(() => !getStoredSeen())
  const [runId, setRunId] = useState(0)

  const restart = () => {
    localStorage.removeItem(STORAGE_KEY)
    setRunId((current) => current + 1)
    setRun(true)
  }

  const stop = () => {
    setRun(false)
  }

  return { run, runId, restart, stop }
}
