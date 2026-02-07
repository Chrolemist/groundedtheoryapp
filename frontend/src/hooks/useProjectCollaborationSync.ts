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
  hasLocalProjectUpdateRef: MutableRefObject<boolean>
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
  hasLocalProjectUpdateRef,
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
  const lastSyncedDataRef = useRef<string | null>(null)
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

    setDocuments(hydrated.documents)
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
    lastSyncedDataRef.current = dataPayload
    hasLocalProjectUpdateRef.current = true
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
    hasLocalProjectUpdateRef,
    sendJson,
    hasRemoteState,
    enableProjectSync,
    disableWs,
    isApplyingRemoteRef,
    persistProject,
  ])

  useEffect(() => {
    const handleSelectionChange = () => {
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
        const getInputCaretRect = (input: HTMLInputElement | HTMLTextAreaElement) => {
          const selectionStart = input.selectionStart
          if (selectionStart === null || selectionStart === undefined) return null
          const computed = window.getComputedStyle(input)
          const lineHeight = parseFloat(computed.lineHeight)
          const fontSize = parseFloat(computed.fontSize)
          const resolvedLineHeight = Number.isFinite(lineHeight) && lineHeight > 0
            ? lineHeight
            : fontSize * 1.2

          if (input instanceof HTMLInputElement) {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            const before = (input.value || '').slice(0, selectionStart)
            const full = input.value || ''
            const letterSpacing = parseFloat(computed.letterSpacing)
            const spacing = Number.isFinite(letterSpacing) ? letterSpacing : 0
            if (ctx) {
              ctx.font = `${computed.fontStyle} ${computed.fontVariant} ${computed.fontWeight} ${computed.fontSize} / ${resolvedLineHeight}px ${computed.fontFamily}`
              const beforeWidth = ctx.measureText(before).width + Math.max(0, before.length - 1) * spacing
              const totalWidth = ctx.measureText(full).width + Math.max(0, full.length - 1) * spacing
              const paddingLeft = parseFloat(computed.paddingLeft)
              const paddingRight = parseFloat(computed.paddingRight)
              const borderLeft = parseFloat(computed.borderLeftWidth)
              const contentWidth = input.clientWidth - paddingLeft - paddingRight
              let alignOffset = 0
              if (computed.textAlign === 'center') {
                alignOffset = (contentWidth - totalWidth) / 2
              } else if (computed.textAlign === 'right' || computed.textAlign === 'end') {
                alignOffset = contentWidth - totalWidth
              }
              const left = borderLeft + paddingLeft + alignOffset + beforeWidth - input.scrollLeft
              const top = (input.clientHeight - resolvedLineHeight) / 2
              return { x: left, y: top, height: resolvedLineHeight }
            }
          }

          const mirror = document.createElement('div')
          mirror.style.position = 'absolute'
          mirror.style.visibility = 'hidden'
          mirror.style.whiteSpace = input instanceof HTMLInputElement ? 'pre' : 'pre-wrap'
          mirror.style.wordWrap = 'break-word'
          mirror.style.wordBreak = 'break-word'
          mirror.style.textAlign = computed.textAlign
          mirror.style.textIndent = computed.textIndent
          mirror.style.direction = computed.direction
          mirror.style.tabSize = computed.tabSize
          mirror.style.boxSizing = computed.boxSizing
          mirror.style.width = `${input.clientWidth}px`
          mirror.style.fontFamily = computed.fontFamily
          mirror.style.fontSize = computed.fontSize
          mirror.style.fontWeight = computed.fontWeight
          mirror.style.fontStyle = computed.fontStyle
          mirror.style.letterSpacing = computed.letterSpacing
          mirror.style.textTransform = computed.textTransform
          mirror.style.lineHeight = computed.lineHeight
          mirror.style.padding = computed.padding
          mirror.style.border = computed.border

          const value = input.value || ''
          const before = value.slice(0, selectionStart)
          mirror.textContent = before
          const marker = document.createElement('span')
          marker.textContent = value.slice(selectionStart, selectionStart + 1) || '\u200b'
          mirror.appendChild(marker)
          document.body.appendChild(mirror)

          const mirrorRect = mirror.getBoundingClientRect()
          const markerRect = marker.getBoundingClientRect()
          document.body.removeChild(mirror)

          const left = (markerRect.left - mirrorRect.left) - input.scrollLeft
          const top = (markerRect.top - mirrorRect.top) - input.scrollTop
          const height = markerRect.height || resolvedLineHeight
          return { x: left, y: top, height }
        }

        const caretRect = getInputCaretRect(activeElement)
        if (caretRect) {
          sendJson?.({
            type: 'cursor:update',
            cursor: {
              x: caretRect.x,
              y: caretRect.y,
              fieldId: activeElement.id || undefined,
              height: caretRect.height,
              absolute: false,
              updatedAt: Date.now(),
            },
          })
          return
        }
      }

      if (activeElement instanceof HTMLElement && activeElement.isContentEditable) {
        const fieldId = activeElement.id
        const selection = window.getSelection()
        if (fieldId && selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0).cloneRange()
          range.collapse(false)
          const rects = range.getClientRects()
          let rect = rects[0] ?? range.getBoundingClientRect()
          if ((!rect || (!rect.width && !rect.height)) && range.startContainer instanceof HTMLElement) {
            rect = range.startContainer.getBoundingClientRect()
          }
          if (rect && Number.isFinite(rect.left) && Number.isFinite(rect.top)) {
            const fieldRect = activeElement.getBoundingClientRect()
            const computed = window.getComputedStyle(activeElement)
            const lineHeight = parseFloat(computed.lineHeight)
            const fontSize = parseFloat(computed.fontSize)
            const resolvedLineHeight = Number.isFinite(lineHeight) && lineHeight > 0
              ? lineHeight
              : fontSize * 1.2
            sendJson?.({
              type: 'cursor:update',
              cursor: {
                x: rect.left - fieldRect.left,
                y: rect.top - fieldRect.top,
                fieldId,
                height: Math.max(2, Math.min(rect.height || resolvedLineHeight, resolvedLineHeight)),
                absolute: false,
                updatedAt: Date.now(),
              },
            })
            return
          }
        }
      }

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
        sendJson?.({ type: 'selection:clear' })
      } else {
        const nextRange = selection.getRangeAt(0)
        selectionRangeRef.current = nextRange.cloneRange()
        selectionDocumentIdRef.current = getSelectionDocumentId(nextRange)
      }

      const rect = getCaretRect(selection)
      const docId = docContainer.getAttribute('data-doc-id') ?? undefined
      const editor = docId ? documentEditorInstancesRef.current.get(docId) : undefined
      const docPos = editor?.state?.selection?.to
      let selectionFrom = editor?.state?.selection?.from
      let selectionTo = editor?.state?.selection?.to
      if (
        editor &&
        (typeof selectionFrom !== 'number' || typeof selectionTo !== 'number' || selectionFrom === selectionTo)
      ) {
        try {
          const mappedFrom = editor.view.posAtDOM(range.startContainer, range.startOffset)
          const mappedTo = editor.view.posAtDOM(range.endContainer, range.endOffset)
          if (mappedFrom !== mappedTo) {
            selectionFrom = Math.min(mappedFrom, mappedTo)
            selectionTo = Math.max(mappedFrom, mappedTo)
          }
        } catch {
          // Ignore DOM mapping failures.
        }
      }
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

      if (docId) {
        const contentContainer = docContainer.querySelector('.document-content') as HTMLElement | null
        const containerRect = (contentContainer ?? docContainer).getBoundingClientRect()
        const rects = Array.from(selection.getRangeAt(0).getClientRects())
          .map((rect) => ({
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height,
          }))
          .filter((rect) => rect.width > 0 && rect.height > 0)

        if (rects.length) {
          sendJson?.({
            type: 'selection:update',
            selection: {
              documentId: docId,
              from: typeof selectionFrom === 'number' ? selectionFrom : 0,
              to: typeof selectionTo === 'number' ? selectionTo : 0,
              rects,
              updatedAt: Date.now(),
            },
          })
          return
        }
        sendJson?.({ type: 'selection:clear' })
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
        setDocumentFontFamilyDisplay((current) =>
          current === documentFontFamily ? current : documentFontFamily,
        )
        return
      }

      if (fonts.size === 1) {
        const next = Array.from(fonts)[0]
        setDocumentFontFamilyDisplay((current) => (current === next ? current : next))
        return
      }

      setDocumentFontFamilyDisplay((current) => (current === '__mixed__' ? current : '__mixed__'))
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
