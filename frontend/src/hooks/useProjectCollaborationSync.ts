import { useCallback, useEffect, useRef, type MutableRefObject, type Dispatch, type SetStateAction } from 'react'
import type { Editor } from '@tiptap/react'
import { type Category, type Code, type Memo } from '../types'
import { type DocumentItem } from '../components/DashboardLayout.types'
import { hydrateRemoteProject } from '../lib/projectHydration'

type UseProjectCollaborationSyncArgs = {
  sendJson?: (payload: Record<string, unknown>) => void
  hasRemoteState: boolean
  isApplyingRemoteRef: MutableRefObject<boolean>
  selectionRangeRef: MutableRefObject<Range | null>
  selectionDocumentIdRef: MutableRefObject<string | null>
  getSelectionDocumentId: (range: Range) => string | null
  documentEditorInstancesRef: MutableRefObject<Map<string, Editor>>
  documentFontFamily: string
  setDocumentFontFamilyDisplay: Dispatch<SetStateAction<string>>
  documents: DocumentItem[]
  codes: Code[]
  categories: Category[]
  memos: Memo[]
  coreCategoryId: string
  theoryHtml: string
  projectUpdatedAtRef: MutableRefObject<number>
  setDocuments: Dispatch<SetStateAction<DocumentItem[]>>
  setCodes: Dispatch<SetStateAction<Code[]>>
  setCategories: Dispatch<SetStateAction<Category[]>>
  setMemos: Dispatch<SetStateAction<Memo[]>>
  setCoreCategoryId: Dispatch<SetStateAction<string>>
  setTheoryHtml: Dispatch<SetStateAction<string>>
  getReadableTextColor: (hex: string) => string
  persistProject?: (projectRaw: Record<string, unknown>) => void
  enableProjectSync?: boolean
}

// Sync local project state with remote collaboration events.
export function useProjectCollaborationSync({
  sendJson,
  hasRemoteState,
  isApplyingRemoteRef,
  selectionRangeRef,
  selectionDocumentIdRef,
  getSelectionDocumentId,
  documentEditorInstancesRef,
  documentFontFamily,
  setDocumentFontFamilyDisplay,
  documents,
  codes,
  categories,
  memos,
  coreCategoryId,
  theoryHtml,
  projectUpdatedAtRef,
  setDocuments,
  setCodes,
  setCategories,
  setMemos,
  setCoreCategoryId,
  setTheoryHtml,
  getReadableTextColor,
  persistProject,
  enableProjectSync = true,
}: UseProjectCollaborationSyncArgs) {
  const persistTimerRef = useRef<number | null>(null)
  const latestProjectRef = useRef<Record<string, unknown> | null>(null)
  const lastSyncedPayloadRef = useRef<string | null>(null)
  const idlePersistDelayMs = 1200
  const disableWs = import.meta.env.VITE_DISABLE_WS === 'true'
  const broadcastRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
    }
  }, [])

  const applyRemoteProject = useCallback((project: Record<string, unknown>) => {
    const incomingUpdatedAt =
      typeof project.updated_at === 'number' ? project.updated_at : 0
    const shouldApply =
      incomingUpdatedAt > projectUpdatedAtRef.current || projectUpdatedAtRef.current === 0
    if (!shouldApply) return

    isApplyingRemoteRef.current = true

    const hydrated = hydrateRemoteProject(project, getReadableTextColor)

    setDocuments((prev) => hydrated.documents.length ? hydrated.documents : prev)
    if (hydrated.codes.length) setCodes(hydrated.codes)
    if (hydrated.categories.length) setCategories(hydrated.categories)
    if (hydrated.memos) setMemos(hydrated.memos)

    if (typeof hydrated.coreCategoryId === 'string') {
      setCoreCategoryId(hydrated.coreCategoryId)
    }

    if (typeof hydrated.theoryHtml === 'string') {
      setTheoryHtml(hydrated.theoryHtml)
    }

    const nextUpdatedAt = incomingUpdatedAt || Date.now()
    projectUpdatedAtRef.current = nextUpdatedAt

    setTimeout(() => {
      isApplyingRemoteRef.current = false
    }, 0)
  }, [
    getReadableTextColor,
    isApplyingRemoteRef,
    projectUpdatedAtRef,
    setDocuments,
    setCodes,
    setCategories,
    setMemos,
    setCoreCategoryId,
    setTheoryHtml,
  ])

  useEffect(() => {
    if (!disableWs) return undefined
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return undefined
    const channel = new BroadcastChannel('gt-project')
    broadcastRef.current = channel
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | undefined
      if (!data || data.type !== 'project:update') return
      const projectRaw = (data.project_raw ?? data.project) as Record<string, unknown> | undefined
      if (!projectRaw) return
      applyRemoteProject(projectRaw)
    }
    channel.addEventListener('message', handleMessage)
    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
      broadcastRef.current = null
    }
  }, [applyRemoteProject, disableWs])

  useEffect(() => {
    if (isApplyingRemoteRef.current) return
    const projectRaw = {
      documents,
      codes,
      categories,
      memos,
      coreCategoryId,
      theoryHtml,
      updated_at: projectUpdatedAtRef.current,
    }
    const payload = JSON.stringify(projectRaw)
    if (payload === lastSyncedPayloadRef.current) {
      return
    }
    lastSyncedPayloadRef.current = payload

    if (enableProjectSync && hasRemoteState && sendJson) {
      sendJson({
        type: 'project:update',
        project_raw: projectRaw,
      })
    }

    if (disableWs && broadcastRef.current) {
      broadcastRef.current.postMessage({
        type: 'project:update',
        project_raw: projectRaw,
      })
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
    sendJson,
    hasRemoteState,
    enableProjectSync,
    disableWs,
    isApplyingRemoteRef,
    persistProject,
  ])

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        sendJson?.({ type: 'cursor:clear' })
        return
      }

      const getCaretRect = (input: Selection) => {
        const range = input.getRangeAt(0).cloneRange()
        range.collapse(false)
        const rects = range.getClientRects()
        let rect = rects[0] ?? range.getBoundingClientRect()
        if ((!rect || (!rect.width && !rect.height)) && range.startContainer instanceof HTMLElement) {
          rect = range.startContainer.getBoundingClientRect()
        }
        if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null
        return rect
      }

      const range = selection.getRangeAt(0)
      const containerNode = range.commonAncestorContainer
      const containerElement =
        containerNode instanceof HTMLElement ? containerNode : containerNode.parentElement
      if (!containerElement) {
        sendJson?.({ type: 'cursor:clear' })
        return
      }
      const docContainer = containerElement.closest('[data-doc-id]') as HTMLElement | null
      if (!docContainer) {
        sendJson?.({ type: 'cursor:clear' })
        return
      }

      if (selection.isCollapsed) {
        selectionRangeRef.current = null
        selectionDocumentIdRef.current = null
      } else {
        const nextRange = selection.getRangeAt(0)
        selectionRangeRef.current = nextRange.cloneRange()
        selectionDocumentIdRef.current = getSelectionDocumentId(nextRange)
      }

      const rect = getCaretRect(selection)
      const docId = docContainer.getAttribute('data-doc-id') ?? undefined
      const editor = docId ? documentEditorInstancesRef.current.get(docId) : undefined
      const docPos = editor?.state?.selection?.to
      if (rect) {
        const containerRect = docContainer.getBoundingClientRect()
        const relativeX = rect.left - containerRect.left
        const relativeY = rect.top - containerRect.top
        sendJson?.({
          type: 'cursor:update',
          cursor: {
            x: relativeX,
            y: relativeY,
            documentId: docId,
            docPos: typeof docPos === 'number' ? docPos : undefined,
            updatedAt: Date.now(),
          },
        })
      }

      const fonts = new Set<string>()
      const shouldInspectRange = !selection.isCollapsed
      const inspectNode = (node: Node) => {
        if (!(node instanceof HTMLElement)) return
        const inlineFont = node.style.fontFamily?.trim()
        if (inlineFont) {
          fonts.add(inlineFont)
        }
      }

      if (shouldInspectRange && typeof range.intersectsNode === 'function') {
        const walker = document.createTreeWalker(containerElement, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) =>
            range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
        })
        while (walker.nextNode()) {
          inspectNode((walker.currentNode as Node).parentElement ?? (walker.currentNode as Node))
          if (fonts.size > 1) break
        }
      } else {
        const anchorElement =
          selection.anchorNode instanceof HTMLElement
            ? selection.anchorNode
            : selection.anchorNode?.parentElement
        if (anchorElement) {
          inspectNode(anchorElement)
        }
      }

      if (fonts.size === 0) {
        setDocumentFontFamilyDisplay(documentFontFamily)
        return
      }

      if (fonts.size === 1) {
        setDocumentFontFamilyDisplay(Array.from(fonts)[0])
        return
      }

      setDocumentFontFamilyDisplay('__mixed__')
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('input', handleSelectionChange)
    document.addEventListener('keyup', handleSelectionChange)
    document.addEventListener('pointerup', handleSelectionChange)
    handleSelectionChange()

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('input', handleSelectionChange)
      document.removeEventListener('keyup', handleSelectionChange)
      document.removeEventListener('pointerup', handleSelectionChange)
    }
  }, [
    documentFontFamily,
    setDocumentFontFamilyDisplay,
    sendJson,
    getSelectionDocumentId,
    selectionRangeRef,
    selectionDocumentIdRef,
    documentEditorInstancesRef,
  ])

  return { applyRemoteProject }
}
