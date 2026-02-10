import { useCallback, useRef, useState, type MutableRefObject } from 'react'

type UseProjectPersistenceArgs = {
  apiBase: string
  hasRemoteState: boolean
  remoteLoadedRef: MutableRefObject<boolean>
  projectId?: string | null
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
  hasRemoteState,
  remoteLoadedRef,
  projectId,
}: UseProjectPersistenceArgs): UseProjectPersistenceResult {
  const debugEnabled =
    typeof window !== 'undefined' && window.localStorage.getItem('gt-debug') === 'true'
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
      if (!apiBase) {
        if (debugEnabled) console.warn('[Project Save] skip (no apiBase)')
        return
      }
      if (!projectId) {
        if (debugEnabled) console.warn('[Project Save] skip (no projectId)')
        return
      }
      // Persistence should not depend on WebSocket presence.
      // In prod we observed "only saves when 2 collaborators" which was caused by
      // hasRemoteState/remoteLoaded gating. Server-side guardrails now prevent empty overwrites.
      if (debugEnabled && !hasRemoteState && !remoteLoadedRef.current) {
        console.warn('[Project Save] proceeding without remote handshake', {
          hasRemoteState,
          remoteLoaded: remoteLoadedRef.current,
        })
      }
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
          // Read body once and attempt to parse JSON; if parsing fails we still keep the text.
          let bodyText: string | undefined
          let data:
            | { status?: string; message?: string; reason?: string; updated_at?: number }
            | undefined
          try {
            bodyText = await response.text()
          } catch {
            bodyText = undefined
          }
          if (bodyText) {
            try {
              data = JSON.parse(bodyText) as typeof data
            } catch {
              data = undefined
            }
          }

          if (debugEnabled) {
            console.log('[Project Save] response', {
              ok: response.ok,
              status: response.status,
              data,
              bodyText: bodyText ? bodyText.slice(0, 500) : undefined,
            })
          }

          if (!response.ok) {
            const message =
              data?.message ||
              (bodyText ? `Save failed: ${response.status} ${bodyText.slice(0, 200)}` : `Save failed: ${response.status}`)
            throw new Error(message)
          }

          if (data?.status && data.status !== 'ok') {
            const message = data.message || `Save failed: ${data.status}`
            throw new Error(message)
          }
          if (saveSeqRef.current !== seq) return
          remoteLoadedRef.current = true
          // If backend returned canonical updated_at, prefer that in diagnostics.
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
    [apiBase, hasRemoteState, remoteLoadedRef, projectId, updateWarning],
  )

  return { persistProject, isSaving, lastSavedAt, saveError, saveWarning }
}
