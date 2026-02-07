import { useCallback, useRef, useState, type MutableRefObject } from 'react'

type UseProjectPersistenceArgs = {
  apiBase: string
  disableWs: boolean
  hasRemoteState: boolean
  remoteLoadedRef: MutableRefObject<boolean>
}

type UseProjectPersistenceResult = {
  persistProject: (projectRaw: Record<string, unknown>) => void
  isSaving: boolean
  lastSavedAt: number | null
  saveError: string | null
}

export function useProjectPersistence({
  apiBase,
  disableWs,
  hasRemoteState,
  remoteLoadedRef,
}: UseProjectPersistenceArgs): UseProjectPersistenceResult {
  const saveSeqRef = useRef(0)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const persistProject = useCallback(
    (projectRaw: Record<string, unknown>) => {
      if (disableWs) return
      if (!apiBase) return
      if (!hasRemoteState && !remoteLoadedRef.current) return
      const seq = saveSeqRef.current + 1
      saveSeqRef.current = seq
      setIsSaving(true)
      setSaveError(null)
      fetch(`${apiBase}/project/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_raw: projectRaw }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Save failed: ${response.status}`)
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
    [apiBase, disableWs, hasRemoteState, remoteLoadedRef],
  )

  return { persistProject, isSaving, lastSavedAt, saveError }
}
