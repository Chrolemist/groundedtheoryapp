import { useEffect, useRef, type MutableRefObject } from 'react'
import { type Category, type Code, type Memo } from '../types'
import { type DocumentItem } from '../components/DashboardLayout.types'

type UseProjectAutosaveArgs = {
  documents: DocumentItem[]
  codes: Code[]
  categories: Category[]
  memos: Memo[]
  coreCategoryId: string
  theoryHtml: string
  projectUpdatedAtRef: MutableRefObject<number>
  hasLocalProjectUpdateRef: MutableRefObject<boolean>
  isApplyingRemoteRef: MutableRefObject<boolean>
  hasRemoteState: boolean
  sendJson?: (payload: Record<string, unknown>) => void
  persistProject?: (projectRaw: Record<string, unknown>) => void
  enableProjectSync?: boolean
  onBroadcastProjectUpdate?: (projectRaw: Record<string, unknown>) => void
  idlePersistDelayMs?: number
}

export function useProjectAutosave({
  documents,
  codes,
  categories,
  memos,
  coreCategoryId,
  theoryHtml,
  projectUpdatedAtRef,
  hasLocalProjectUpdateRef,
  isApplyingRemoteRef,
  hasRemoteState,
  sendJson,
  persistProject,
  enableProjectSync = true,
  onBroadcastProjectUpdate,
  idlePersistDelayMs = 1200,
}: UseProjectAutosaveArgs) {
  const persistTimerRef = useRef<number | null>(null)
  const latestProjectRef = useRef<Record<string, unknown> | null>(null)
  const lastSyncedDataRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (isApplyingRemoteRef.current) return
    const isEmptyProject =
      documents.length === 0 &&
      codes.length === 0 &&
      categories.length === 0 &&
      memos.length === 0 &&
      !coreCategoryId &&
      !theoryHtml
    if (isEmptyProject && !hasLocalProjectUpdateRef.current) return

    const dataSnapshot = {
      documents,
      codes,
      categories,
      memos,
      coreCategoryId,
      theoryHtml,
    }
    const dataPayload = JSON.stringify(dataSnapshot)
    if (dataPayload === lastSyncedDataRef.current) {
      return
    }
    if (!hasLocalProjectUpdateRef.current) {
      lastSyncedDataRef.current = dataPayload
      return
    }
    lastSyncedDataRef.current = dataPayload
    hasLocalProjectUpdateRef.current = false
    const nextUpdatedAt = Date.now()
    projectUpdatedAtRef.current = nextUpdatedAt

    const projectRaw = {
      ...dataSnapshot,
      updated_at: nextUpdatedAt,
    }

    if (enableProjectSync && hasRemoteState && sendJson) {
      sendJson({
        type: 'project:update',
        project_raw: projectRaw,
      })
    }

    if (onBroadcastProjectUpdate) {
      onBroadcastProjectUpdate(projectRaw)
    }

    if (persistProject) {
      latestProjectRef.current = projectRaw
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current)
      }
      persistTimerRef.current = window.setTimeout(() => {
        if (latestProjectRef.current) {
          persistProject(latestProjectRef.current)
        }
      }, idlePersistDelayMs)
    }
  }, [
    documents,
    codes,
    categories,
    memos,
    coreCategoryId,
    theoryHtml,
    projectUpdatedAtRef,
    hasLocalProjectUpdateRef,
    isApplyingRemoteRef,
    hasRemoteState,
    sendJson,
    persistProject,
    enableProjectSync,
    onBroadcastProjectUpdate,
    idlePersistDelayMs,
  ])
}
