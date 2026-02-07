import { useCallback, useRef, useState, type MutableRefObject } from 'react'

type UseProjectPersistenceArgs = {
  apiBase: string
  disableWs: boolean
  hasRemoteState: boolean
  remoteLoadedRef: MutableRefObject<boolean>
  projectIdRef: MutableRefObject<string | null>
}

type UseProjectPersistenceResult = {
  persistProject: (projectRaw: Record<string, unknown>) => void
  isSaving: boolean
  lastSavedAt: number | null
  saveError: string | null
  saveWarning: string | null
}

export function useProjectPersistence({
  apiBase,
  disableWs,
  hasRemoteState,
  remoteLoadedRef,
  projectIdRef,
}: UseProjectPersistenceArgs): UseProjectPersistenceResult {
  const saveSeqRef = useRef(0)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveWarning, setSaveWarning] = useState<string | null>(null)
  const maxBytes = Number(import.meta.env.VITE_MAX_PROJECT_BYTES) || 900000
  const warnRatio = Number(import.meta.env.VITE_PROJECT_WARN_RATIO) || 0.85
  const warnThreshold = Math.max(1, Math.floor(maxBytes * warnRatio))

  const updateWarning = useCallback((projectRaw: Record<string, unknown>) => {
    try {
      const payload = JSON.stringify(projectRaw)
      const bytes = new TextEncoder().encode(payload).length
      if (bytes >= warnThreshold) {
        setSaveWarning(
          `Projektet är ${(bytes / maxBytes * 100).toFixed(0)}% av maxstorleken. Exportera gärna en backup.`,
        )
      } else {
        setSaveWarning(null)
      }
    } catch {
      setSaveWarning(null)
    }
  }, [maxBytes, warnThreshold])

  const persistProject = useCallback(
    (projectRaw: Record<string, unknown>) => {
      if (disableWs) return
      if (!apiBase) return
      const projectId = projectIdRef.current
      if (!projectId) return
      if (!hasRemoteState && !remoteLoadedRef.current) return
      updateWarning(projectRaw)
      const seq = saveSeqRef.current + 1
      saveSeqRef.current = seq
      setIsSaving(true)
      setSaveError(null)
      fetch(`${apiBase}/projects/${projectId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_raw: projectRaw }),
      })
        .then(async (response) => {
          if (!response.ok) {
            let message = `Save failed: ${response.status}`
            try {
              const data = (await response.json()) as { message?: string } | undefined
              if (data?.message) {
                message = data.message
              }
            } catch {
              // Ignore invalid JSON.
            }
            throw new Error(message)
          }
          if (saveSeqRef.current !== seq) return
          setLastSavedAt(Date.now())
        })
        .catch((error) => {
          if (saveSeqRef.current !== seq) return
          const message = error instanceof Error ? error.message : 'Save failed'
          setSaveError(message)
          console.error('[Project Save]', message)
        })
        .finally(() => {
          if (saveSeqRef.current === seq) {
            setIsSaving(false)
          }
        })
    },
    [apiBase, disableWs, hasRemoteState, remoteLoadedRef, projectIdRef, updateWarning],
  )

  return { persistProject, isSaving, lastSavedAt, saveError, saveWarning }
}
