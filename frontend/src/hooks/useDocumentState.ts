import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { type Code } from '../types'
import { type DocumentItem, type DocumentViewMode } from '../components/DashboardLayout.types'

type UseDocumentStateArgs = {
  storedState: {
    documents?: DocumentItem[]
    activeDocumentId?: string
    documentViewMode?: DocumentViewMode
  } | null
  pushHistoryRef: MutableRefObject<() => void>
  isApplyingRemoteRef?: MutableRefObject<boolean>
}

// Document state, editor refs, and document syncing helpers.
export function useDocumentState({
  storedState,
  pushHistoryRef,
  isApplyingRemoteRef,
}: UseDocumentStateArgs) {
  const [documents, setDocuments] = useState<DocumentItem[]>(() =>
    storedState?.documents?.length ? storedState.documents : [],
  )
  const [activeDocumentId, setActiveDocumentId] = useState(() =>
    storedState?.activeDocumentId ?? (storedState?.documents?.[0]?.id ?? ''),
  )
  const [documentViewMode, setDocumentViewMode] = useState<DocumentViewMode>(
    () => storedState?.documentViewMode ?? 'all',
  )
  const documentEditorRef = useRef<HTMLDivElement | null>(null)
  const documentEditorInstanceRef = useRef<Editor | null>(null)
  const documentEditorInstancesRef = useRef(new Map<string, Editor>())
  const lastEditDocumentIdRef = useRef<string | null>(null)
  const isTipTapActive = (node?: HTMLDivElement | null) =>
    documentEditorInstancesRef.current.size > 0 ||
    !!documentEditorInstanceRef.current ||
    node?.dataset.editor === 'tiptap' ||
    !!node?.querySelector('.ProseMirror')
  const [documentLineHeight, setDocumentLineHeight] = useState('1.75')
  const [documentFontFamily, setDocumentFontFamily] = useState('Inter, ui-sans-serif, system-ui')
  const [documentFontFamilyDisplay, setDocumentFontFamilyDisplay] = useState(
    'Inter, ui-sans-serif, system-ui',
  )

  const updateDocument = (documentId: string, patch: Partial<DocumentItem>) => {
    setDocuments((current) =>
      current.map((doc) => (doc.id === documentId ? { ...doc, ...patch } : doc)),
    )
  }

  const getDocumentById = (documentId: string) =>
    documents.find((doc) => doc.id === documentId)

  const addNewDocument = () => {
    pushHistoryRef.current()
    const nextIndex = documents.length + 1
    const newDoc: DocumentItem = {
      id: `doc-${crypto.randomUUID()}`,
      title: `Document ${nextIndex}`,
      text: '',
      html: '',
    }
    setDocuments((current) => [...current, newDoc])
    setActiveDocumentId(newDoc.id)
    setDocumentViewMode('single')
  }

  const removeDocument = (documentId: string) => {
    pushHistoryRef.current()
    setDocuments((current) => {
      const remaining = current.filter((doc) => doc.id !== documentId)
      if (documentId === activeDocumentId) {
        setActiveDocumentId(remaining[0]?.id ?? '')
      }
      return remaining
    })
  }

  const applyCodeStylesToContainer = (container: HTMLElement, nextCodeMap: Map<string, Code>) => {
    container.querySelectorAll('span[data-code-id]').forEach((span) => {
      const codeId = span.getAttribute('data-code-id')
      if (!codeId) return
      const code = nextCodeMap.get(codeId)
      if (!code) return

      const nextBg = code.colorHex ?? '#E2E8F0'
      const nextText = code.textHex ?? '#334155'
      const nextRing = code.ringHex ?? 'rgba(148,163,184,0.4)'

      if (span instanceof HTMLElement) {
        if (span.style.backgroundColor !== nextBg) {
          span.style.backgroundColor = nextBg
        }
        if (span.style.color !== nextText) {
          span.style.color = nextText
        }
        if (span.style.display !== 'inline-block') {
          span.style.display = 'inline-block'
        }
        const nextShadow = `inset 0 0 0 1px ${nextRing}`
        if (span.style.boxShadow !== nextShadow) {
          span.style.boxShadow = nextShadow
        }
      }

      const label = span.querySelector('.code-label') as HTMLElement | null
      if (label) {
        if (label.getAttribute('contenteditable') !== 'false') {
          label.setAttribute('contenteditable', 'false')
        }
        if (!label.hasAttribute('data-non-editable')) {
          label.setAttribute('data-non-editable', 'true')
        }
        if (label.textContent !== code.label) {
          label.textContent = code.label
        }
        if (label.style.color !== nextText) {
          label.style.color = nextText
        }
      }

      const removeButton = span.querySelector('[data-remove-code]') as HTMLElement | null
      const ensureRemoveButton = () => {
        const button = document.createElement('span')
        button.className = 'code-remove'
        button.setAttribute('data-remove-code', 'true')
        button.setAttribute('title', 'Remove highlight')
        button.setAttribute('contenteditable', 'false')
        button.setAttribute('data-non-editable', 'true')
        button.textContent = '×'
        button.style.fontSize = '10px'
        button.style.opacity = '0.7'
        button.style.fontWeight = '700'
        button.style.position = 'absolute'
        button.style.right = '4px'
        button.style.top = '2px'
        button.style.transform = 'none'
        button.style.color = nextText
        button.style.backgroundColor = 'rgba(255,255,255,0.7)'
        button.style.borderRadius = '999px'
        button.style.padding = '0 4px'
        button.style.lineHeight = '1'
        button.style.zIndex = '2'
        button.style.pointerEvents = 'auto'
        span.appendChild(button)
      }

      if (removeButton) {
        if (removeButton.getAttribute('contenteditable') !== 'false') {
          removeButton.setAttribute('contenteditable', 'false')
        }
        if (!removeButton.hasAttribute('data-non-editable')) {
          removeButton.setAttribute('data-non-editable', 'true')
        }
        if (removeButton.style.color !== nextText) {
          removeButton.style.color = nextText
        }
      } else {
        ensureRemoveButton()
      }
    })
  }

  const syncDocumentsForCodes = (current: DocumentItem[], nextCodeMap: Map<string, Code>) => {
    return current.map((doc) => {
      if (!doc.html) return doc
      const container = document.createElement('div')
      container.innerHTML = doc.html

      applyCodeStylesToContainer(container, nextCodeMap)

      const nextHtml = container.innerHTML
      const nextText = container.innerText
      if (nextHtml === doc.html && nextText === doc.text) return doc
      return {
        ...doc,
        html: nextHtml,
        text: nextText,
      }
    })
  }

  const syncEditorForCodes = (nextCodeMap: Map<string, Code>) => {
    const editor = documentEditorRef.current
    if (!editor || isTipTapActive(editor)) return
    const container = document.createElement('div')
    container.innerHTML = editor.innerHTML
    applyCodeStylesToContainer(container, nextCodeMap)
    const nextHtml = container.innerHTML
    if (nextHtml === editor.innerHTML) return
    editor.innerHTML = nextHtml
    updateDocument(activeDocumentId, {
      html: nextHtml,
      text: container.innerText,
    })
  }

  const applyCodeStylesToEditor = (nextCodeMap: Map<string, Code>) => {
    const editor = documentEditorRef.current
    if (!editor || isTipTapActive(editor)) return
    const container = document.createElement('div')
    container.innerHTML = editor.innerHTML
    applyCodeStylesToContainer(container, nextCodeMap)
    if (container.innerHTML !== editor.innerHTML) {
      editor.innerHTML = container.innerHTML
    }
  }

  const stripMapFocus = (value: string) => {
    if (!value.includes('map-focus')) return value
    const container = document.createElement('div')
    container.innerHTML = value
    container.querySelectorAll('.map-focus').forEach((node) => {
      node.classList.remove('map-focus')
    })
    return container.innerHTML
  }

  useEffect(() => {
    if (documentViewMode !== 'single') {
      lastEditDocumentIdRef.current = null
      return
    }
    // When a TipTap editor instance exists, skip direct innerHTML manipulation
    // — TipTap + Yjs manages the content.
    const hasTipTap = isTipTapActive(documentEditorRef.current)
    if (hasTipTap) {
      lastEditDocumentIdRef.current = activeDocumentId
      return
    }
    const editor = documentEditorRef.current
    if (!editor) return
    if (!isApplyingRemoteRef?.current && lastEditDocumentIdRef.current === activeDocumentId) {
      return
    }
    const activeDoc = documents.find((doc) => doc.id === activeDocumentId)
    const nextHtml = activeDoc?.html || activeDoc?.text.replace(/\n/g, '<br />') || ''
    const normalizedCurrent = stripMapFocus(editor.innerHTML)
    const normalizedNext = stripMapFocus(nextHtml)
    if (normalizedCurrent !== normalizedNext) {
      editor.innerHTML = nextHtml
    }
    lastEditDocumentIdRef.current = activeDocumentId
  }, [activeDocumentId, documents, documentViewMode])

  return {
    documents,
    setDocuments,
    activeDocumentId,
    setActiveDocumentId,
    documentViewMode,
    setDocumentViewMode,
    documentEditorRef,
    documentEditorInstanceRef,
    documentEditorInstancesRef,
    setDocumentEditorRef: (node: HTMLDivElement | null) => {
      documentEditorRef.current = node
      // When TipTap editors exist, skip direct innerHTML — TipTap manages content.
      if (!node) return
      if (isTipTapActive(node)) {
        lastEditDocumentIdRef.current = activeDocumentId
        return
      }
      if (documentViewMode !== 'single') return
      const activeDoc = documents.find((doc) => doc.id === activeDocumentId)
      const nextHtml = activeDoc?.html || activeDoc?.text.replace(/\n/g, '<br />') || ''
      const normalizedCurrent = stripMapFocus(node.innerHTML)
      const normalizedNext = stripMapFocus(nextHtml)
      if (normalizedCurrent !== normalizedNext) {
        node.innerHTML = nextHtml
      }
      lastEditDocumentIdRef.current = activeDocumentId
    },
    documentLineHeight,
    setDocumentLineHeight,
    documentFontFamily,
    setDocumentFontFamily,
    documentFontFamilyDisplay,
    setDocumentFontFamilyDisplay,
    setDocumentEditorInstance: (documentId: string, editor: Editor | null) => {
      if (editor) {
        documentEditorInstanceRef.current = editor
        documentEditorInstancesRef.current.set(documentId, editor)
      } else {
        documentEditorInstancesRef.current.delete(documentId)
        if (documentEditorInstanceRef.current && documentEditorInstanceRef.current.isDestroyed) {
          documentEditorInstanceRef.current = null
        }
      }
    },
    updateDocument,
    getDocumentById,
    addNewDocument,
    removeDocument,
    syncDocumentsForCodes,
    syncEditorForCodes,
    applyCodeStylesToContainer,
    applyCodeStylesToEditor,
  }
}
