import { useEffect, useRef, type MutableRefObject, type Dispatch, type SetStateAction } from 'react'
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
  documentFontFamily: string
  setDocumentFontFamilyDisplay: Dispatch<SetStateAction<string>>
  documents: DocumentItem[]
  codes: Code[]
  categories: Category[]
  memos: Memo[]
  coreCategoryId: string
  theoryHtml: string
  setDocuments: Dispatch<SetStateAction<DocumentItem[]>>
  setCodes: Dispatch<SetStateAction<Code[]>>
  setCategories: Dispatch<SetStateAction<Category[]>>
  setMemos: Dispatch<SetStateAction<Memo[]>>
  setCoreCategoryId: Dispatch<SetStateAction<string>>
  setTheoryHtml: Dispatch<SetStateAction<string>>
  getReadableTextColor: (hex: string) => string
  persistProject?: (projectRaw: Record<string, unknown>) => void
}

// Sync local project state with remote collaboration events.
export function useProjectCollaborationSync({
  sendJson,
  hasRemoteState,
  isApplyingRemoteRef,
  selectionRangeRef,
  selectionDocumentIdRef,
  getSelectionDocumentId,
  documentFontFamily,
  setDocumentFontFamilyDisplay,
  documents,
  codes,
  categories,
  memos,
  coreCategoryId,
  theoryHtml,
  setDocuments,
  setCodes,
  setCategories,
  setMemos,
  setCoreCategoryId,
  setTheoryHtml,
  getReadableTextColor,
  persistProject,
}: UseProjectCollaborationSyncArgs) {
  const persistTimerRef = useRef<number | null>(null)
  const latestProjectRef = useRef<Record<string, unknown> | null>(null)
  const idlePersistDelayMs = 1200

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
    }
  }, [])
  const applyRemoteProject = (project: Record<string, unknown>) => {
    isApplyingRemoteRef.current = true

    const hydrated = hydrateRemoteProject(project, getReadableTextColor)

    setDocuments(hydrated.documents.length ? hydrated.documents : documents)
    if (hydrated.codes.length) setCodes(hydrated.codes)
    if (hydrated.categories.length) setCategories(hydrated.categories)
    if (hydrated.memos) setMemos(hydrated.memos)

    if (typeof hydrated.coreCategoryId === 'string') {
      setCoreCategoryId(hydrated.coreCategoryId)
    }

    if (typeof hydrated.theoryHtml === 'string') {
      setTheoryHtml(hydrated.theoryHtml)
    }

    setTimeout(() => {
      isApplyingRemoteRef.current = false
    }, 0)
  }

  useEffect(() => {
    if (isApplyingRemoteRef.current) return
    const projectRaw = {
      documents,
      codes,
      categories,
      memos,
      coreCategoryId,
      theoryHtml,
    }

    if (hasRemoteState && sendJson) {
      sendJson({
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
    sendJson,
    hasRemoteState,
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

      const rect = range.getClientRects()[0] ?? range.getBoundingClientRect()
      if (rect && Number.isFinite(rect.left) && Number.isFinite(rect.top)) {
        sendJson?.({
          type: 'cursor:update',
          cursor: {
            x: rect.left,
            y: rect.top,
            documentId: docContainer.getAttribute('data-doc-id') ?? undefined,
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
    handleSelectionChange()

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [
    documentFontFamily,
    setDocumentFontFamilyDisplay,
    sendJson,
    getSelectionDocumentId,
    selectionRangeRef,
    selectionDocumentIdRef,
  ])

  return { applyRemoteProject }
}
