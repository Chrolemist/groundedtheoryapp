import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Tag, Layers, Trash2 } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { cn } from '../lib/cn'
import { type Category, type Code } from '../types'
import { OnboardingTour } from './OnboardingTour'
import { useOnboardingTour } from '../hooks/useOnboardingTour'
import { useProjectWebSocket } from '../hooks/useProjectWebSocket.ts'
import { DocumentEditor } from './DocumentEditor'
import { CodeChip } from './CodeChip'
import { CategoryCard } from './CategoryCard'
import { MenuBar } from './MenuBar'

type TabKey = 'open' | 'axial' | 'theory'
type DocumentViewMode = 'single' | 'all'

type DocumentItem = {
  id: string
  title: string
  text: string
  html: string
}

type PresenceUser = {
  id: string
  name: string
  color: string
}

type CursorPresence = {
  x: number
  y: number
  documentId?: string
  updatedAt: number
}

const tabConfig: Array<{ key: TabKey; label: string; icon: typeof Tag }> = [
  { key: 'open', label: 'Open Coding', icon: Tag },
  { key: 'axial', label: 'Axial Coding', icon: Layers },
  { key: 'theory', label: 'Selective Coding', icon: Tag },
]

export function DashboardLayout() {
  const storageKey = 'grounded-theory-app-state'
  const loadStoredState = () => {
    if (typeof window === 'undefined') return null
    const saved = localStorage.getItem(storageKey)
    if (!saved) return null
    try {
      return JSON.parse(saved) as {
        codes?: Code[]
        categories?: Category[]
        documents?: DocumentItem[]
        activeDocumentId?: string
        documentViewMode?: DocumentViewMode
        theoryHtml?: string
        coreCategoryId?: string
      }
    } catch {
      return null
    }
  }
  const storedState = loadStoredState()
  const [activeTab, setActiveTab] = useState<TabKey>('open')
  const [codes, setCodes] = useState<Code[]>(() => storedState?.codes ?? [])
  const [categories, setCategories] = useState<Category[]>(() => storedState?.categories ?? [])
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [localUser, setLocalUser] = useState<PresenceUser | null>(null)
  const [remoteCursors, setRemoteCursors] = useState<Record<string, CursorPresence>>({})
  const [hasRemoteState, setHasRemoteState] = useState(false)
  const localUserRef = useRef<PresenceUser | null>(null)
  const isApplyingRemoteRef = useRef(false)
  const { isOnline: websocketOnline, sendJson } = useProjectWebSocket({
    onMessage: (payload) => {
      if (!payload || typeof payload !== 'object') return
      const data = payload as Record<string, unknown>
      const type = data.type as string | undefined

      if (type === 'hello') {
        const user = data.user as PresenceUser | undefined
        if (user) {
          setLocalUser(user)
          localUserRef.current = user
        }
        const users = data.users as PresenceUser[] | undefined
        if (users) setPresenceUsers(users)
        const projectRaw = (data.project_raw ?? data.project) as Record<string, unknown> | undefined
        if (projectRaw) {
          applyRemoteProject(projectRaw)
        }
        setHasRemoteState(true)
        return
      }

      if (type === 'presence:update') {
        const users = data.users as PresenceUser[] | undefined
        if (users) setPresenceUsers(users)
        return
      }

      if (type === 'cursor:update') {
        const userId = data.userId as string | undefined
        const cursor = data.cursor as CursorPresence | undefined
        if (!userId || !cursor) return
        setRemoteCursors((current) => ({
          ...current,
          [userId]: cursor,
        }))
        return
      }

      if (type === 'cursor:clear') {
        const userId = data.userId as string | undefined
        if (!userId) return
        setRemoteCursors((current) => {
          const next = { ...current }
          delete next[userId]
          return next
        })
        return
      }

      if (type === 'project:update') {
        const senderId = data.sender_id as string | undefined
        if (senderId && senderId === localUserRef.current?.id) return
        const projectRaw = (data.project_raw ?? data.project) as Record<string, unknown> | undefined
        if (projectRaw) {
          applyRemoteProject(projectRaw)
        }
      }
    },
  })
  const [documents, setDocuments] = useState<DocumentItem[]>(() =>
    storedState?.documents?.length
      ? storedState.documents
      : [
          {
            id: 'doc-1',
            title: 'Document 1',
            text: '',
            html: '',
          },
        ],
  )
  const [activeDocumentId, setActiveDocumentId] = useState(() =>
    storedState?.activeDocumentId ?? (storedState?.documents?.[0]?.id ?? 'doc-1'),
  )
  const [documentViewMode, setDocumentViewMode] = useState<DocumentViewMode>(
    () => storedState?.documentViewMode ?? 'single',
  )
  const documentEditorRef = useRef<HTMLDivElement | null>(null)
  const selectionRangeRef = useRef<Range | null>(null)
  const selectionDocumentIdRef = useRef<string | null>(null)
  const lastEditDocumentIdRef = useRef<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const theoryEditorRef = useRef<HTMLDivElement | null>(null)
  const [theoryHtml, setTheoryHtml] = useState(() => storedState?.theoryHtml ?? '')
  const [coreCategoryId, setCoreCategoryId] = useState(() => storedState?.coreCategoryId ?? '')
  const [showCodeLabels, setShowCodeLabels] = useState(true)
  const [documentLineHeight, setDocumentLineHeight] = useState('1.75')
  const [documentFontFamily, setDocumentFontFamily] = useState('Inter, ui-sans-serif, system-ui')
  const [documentFontFamilyDisplay, setDocumentFontFamilyDisplay] = useState(
    'Inter, ui-sans-serif, system-ui',
  )
  const tour = useOnboardingTour()
  const historyRef = useRef<{
    past: Array<{
      documents: DocumentItem[]
      codes: Code[]
      categories: Category[]
      activeDocumentId: string
      documentViewMode: DocumentViewMode
      theoryHtml: string
      coreCategoryId: string
    }>
    future: Array<{
      documents: DocumentItem[]
      codes: Code[]
      categories: Category[]
      activeDocumentId: string
      documentViewMode: DocumentViewMode
      theoryHtml: string
      coreCategoryId: string
    }>
  }>({ past: [], future: [] })

  const handleRenameUser = () => {
    const currentName = localUser?.name ?? ''
    const nextName = window.prompt('Your name', currentName)?.trim()
    if (!nextName) return
    sendJson({ type: 'presence:rename', name: nextName })
  }

  const codeById = useMemo(() => {
    return new Map(codes.map((code) => [code.id, code]))
  }, [codes])

  const presenceById = useMemo(() => {
    return new Map(presenceUsers.map((user) => [user.id, user]))
  }, [presenceUsers])

  function applyRemoteProject(project: Record<string, unknown>) {
    isApplyingRemoteRef.current = true

    const incomingDocuments = Array.isArray(project.documents)
      ? (project.documents as Array<Record<string, unknown>>).map((doc) => ({
          id: String(doc.id ?? ''),
          title: String(doc.title ?? ''),
          html: String(doc.html ?? ''),
          text: String(doc.text ?? doc.content ?? ''),
        }))
      : []

    const incomingCodes = Array.isArray(project.codes)
      ? (project.codes as Array<Record<string, unknown>>).map((code) => {
          const colorHex = String(code.colorHex ?? code.color ?? '#E2E8F0')
          const textHex = String(code.textHex ?? getReadableTextColor(colorHex))
          return {
            id: String(code.id ?? ''),
            label: String(code.label ?? code.name ?? 'Untitled'),
            description: String(code.description ?? ''),
            colorClass: String(code.colorClass ?? 'bg-slate-100 text-slate-700 ring-slate-200'),
            colorHex,
            textHex,
            ringHex: String(code.ringHex ?? `${textHex}33`),
          }
        })
      : []

    const incomingCategories = Array.isArray(project.categories)
      ? (project.categories as Array<Record<string, unknown>>).map((category) => ({
          id: String(category.id ?? ''),
          name: String(category.name ?? ''),
          codeIds: Array.isArray(category.codeIds)
            ? (category.codeIds as string[])
            : Array.isArray(category.contained_code_ids)
              ? (category.contained_code_ids as string[])
              : [],
          precondition: String(category.precondition ?? ''),
          action: String(category.action ?? ''),
          consequence: String(category.consequence ?? ''),
        }))
      : []

    setDocuments(incomingDocuments.length ? incomingDocuments : documents)
    if (incomingCodes.length) setCodes(incomingCodes)
    if (incomingCategories.length) setCategories(incomingCategories)

    if (typeof project.coreCategoryId === 'string') {
      setCoreCategoryId(project.coreCategoryId)
    } else if (typeof project.core_category_id === 'string') {
      setCoreCategoryId(project.core_category_id)
    }

    if (typeof project.theoryHtml === 'string') {
      setTheoryHtml(project.theoryHtml)
    } else if (typeof project.theory_description === 'string') {
      setTheoryHtml(project.theory_description)
    }

    setTimeout(() => {
      isApplyingRemoteRef.current = false
    }, 0)
  }

  useEffect(() => {
    localUserRef.current = localUser
  }, [localUser])

  useEffect(() => {
    if (isApplyingRemoteRef.current) return
    if (!hasRemoteState) return
    if (!sendJson) return
    sendJson({
      type: 'project:update',
      project_raw: {
        documents,
        codes,
        categories,
        coreCategoryId,
        theoryHtml,
      },
    })
  }, [documents, codes, categories, coreCategoryId, theoryHtml, sendJson, hasRemoteState])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now()
      setRemoteCursors((current) => {
        const next: Record<string, CursorPresence> = {}
        Object.entries(current).forEach(([userId, cursor]) => {
          if (now - cursor.updatedAt < 8000) {
            next[userId] = cursor
          }
        })
        return next
      })
    }, 3000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  function updateDocument(documentId: string, patch: Partial<DocumentItem>) {
    setDocuments((current) =>
      current.map((doc) => (doc.id === documentId ? { ...doc, ...patch } : doc)),
    )
  }

  function getSelectionDocumentId(range: Range) {
    const node = range.commonAncestorContainer
    const element = node instanceof HTMLElement ? node : node.parentElement
    const container = element?.closest('[data-doc-id]')
    return container?.getAttribute('data-doc-id') ?? null
  }

  function applyCodeStylesToContainer(
    container: HTMLElement,
    nextCodeMap: Map<string, Code>,
  ) {
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

  useEffect(() => {
    const payload = JSON.stringify({
      codes,
      categories,
      documents,
      activeDocumentId,
      documentViewMode,
      theoryHtml,
      coreCategoryId,
    })
    localStorage.setItem(storageKey, payload)
  }, [codes, categories, documents, activeDocumentId, documentViewMode, theoryHtml, coreCategoryId])

  useEffect(() => {
    if (documentViewMode !== 'single') {
      lastEditDocumentIdRef.current = null
      return
    }
    const editor = documentEditorRef.current
    if (!editor) return
    if (lastEditDocumentIdRef.current === activeDocumentId) return
    const activeDoc = documents.find((doc) => doc.id === activeDocumentId)
    const nextHtml =
      activeDoc?.html || activeDoc?.text.replace(/\n/g, '<br />') || ''
    editor.innerHTML = nextHtml
    const container = document.createElement('div')
    container.innerHTML = editor.innerHTML
    applyCodeStylesToContainer(container, codeById)
    if (container.innerHTML !== editor.innerHTML) {
      editor.innerHTML = container.innerHTML
    }
    lastEditDocumentIdRef.current = activeDocumentId
  }, [activeDocumentId, documents, codeById, documentViewMode])

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
        const range = selection.getRangeAt(0)
        selectionRangeRef.current = range.cloneRange()
        selectionDocumentIdRef.current = getSelectionDocumentId(range)
      }

      const rect = range.getClientRects()[0] ?? range.getBoundingClientRect()
      if (rect && Number.isFinite(rect.left) && Number.isFinite(rect.top)) {
        const cursorPayload: CursorPresence = {
          x: rect.left,
          y: rect.top,
          documentId: docContainer.getAttribute('data-doc-id') ?? undefined,
          updatedAt: Date.now(),
        }
        sendJson?.({ type: 'cursor:update', cursor: cursorPayload })
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
        const walker = document.createTreeWalker(
          containerElement,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) =>
              range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
          },
        )
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
  }, [documentFontFamily, sendJson])

  useEffect(() => {
    const editor = theoryEditorRef.current
    if (!editor) return
    if (document.activeElement === editor) return
    if (editor.innerHTML !== theoryHtml) {
      editor.innerHTML = theoryHtml
    }
  }, [theoryHtml])

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
    if (!editor) return
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

  const assignedCodeIds = useMemo(() => {
    return new Set(categories.flatMap((category) => category.codeIds))
  }, [categories])

  const ungroupedCodes = useMemo(() => {
    return codes.filter((code) => !assignedCodeIds.has(code.id))
  }, [codes, assignedCodeIds])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const placeCaretInContent = (content: HTMLElement, event?: React.MouseEvent<HTMLElement>) => {
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.selectNodeContents(content)
    if (event) {
      const rect = content.getBoundingClientRect()
      const atStart = event.clientX < rect.left + rect.width / 2
      range.collapse(atStart)
    } else {
      range.collapse(false)
    }
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const handleHighlightMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-remove-code]')) return
    const highlight = target.closest('span[data-code-id]') as HTMLElement | null
    if (!highlight) return
    const content = highlight.querySelector('.code-content') as HTMLElement | null
    if (!content) return
    if (content.contains(target) && !target.closest('.code-label')) return
    event.preventDefault()
    event.stopPropagation()
    placeCaretInContent(content, event)
  }

  const handleSelection = () => {
    const selectionRef = window.getSelection()
    if (!selectionRef || selectionRef.isCollapsed) {
      selectionRangeRef.current = null
      selectionDocumentIdRef.current = null
      return
    }

    const range = selectionRef.getRangeAt(0)
    const text = selectionRef.toString().trim()

    if (!text) {
      return
    }
    selectionRangeRef.current = range.cloneRange()
    selectionDocumentIdRef.current = getSelectionDocumentId(range)
  }

  const getClosestRemoveButton = (target: EventTarget | null) => {
    const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null
    return element?.closest('[data-remove-code]') as HTMLElement | null
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    if (!event.over) return

    const targetId = String(event.over.id)
    if (!targetId.startsWith('category-')) return

    const movedCodeId = String(event.active.id)
    setCategories((current) =>
      current.map((category) => {
        const filtered = category.codeIds.filter((id) => id !== movedCodeId)
        if (category.id !== targetId) return { ...category, codeIds: filtered }
        if (filtered.includes(movedCodeId)) return { ...category, codeIds: filtered }
        return { ...category, codeIds: [...filtered, movedCodeId] }
      }),
    )
  }

  const applyEditorCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    theoryEditorRef.current?.focus()
  }

  const applyDocumentCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    documentEditorRef.current?.focus()
  }

  const getActiveEditable = () => {
    const activeElement = document.activeElement as HTMLElement | null
    if (documentEditorRef.current && activeElement && documentEditorRef.current.contains(activeElement)) {
      return documentEditorRef.current
    }
    if (theoryEditorRef.current && activeElement && theoryEditorRef.current.contains(activeElement)) {
      return theoryEditorRef.current
    }
    if (activeElement?.isContentEditable) return activeElement as HTMLDivElement
    return null
  }

  const executeEditorCommand = (command: string, value?: string) => {
    const target = getActiveEditable()
    if (!target) return false
    target.focus()
    document.execCommand(command, false, value)
    return true
  }

  const insertHtmlAtCursor = (html: string) => {
    const target = getActiveEditable()
    if (!target) return false
    target.focus()
    if (document.queryCommandSupported?.('insertHTML')) {
      document.execCommand('insertHTML', false, html)
      return true
    }
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false
    selection.deleteFromDocument()
    const temp = document.createElement('span')
    temp.innerHTML = html
    selection.getRangeAt(0).insertNode(temp)
    selection.collapseToEnd()
    return true
  }

  const pasteFromClipboard = async () => {
    const canRead = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText
    if (!canRead) {
      executeEditorCommand('paste')
      return
    }

    try {
      const text = await navigator.clipboard.readText()
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r\n|\r|\n/g, '<br>')
      insertHtmlAtCursor(escaped)
    } catch {
      executeEditorCommand('paste')
    }
  }

  const isSameSnapshot = (
    a: {
      documents: DocumentItem[]
      codes: Code[]
      categories: Category[]
      activeDocumentId: string
      documentViewMode: DocumentViewMode
      theoryHtml: string
      coreCategoryId: string
    },
    b: {
      documents: DocumentItem[]
      codes: Code[]
      categories: Category[]
      activeDocumentId: string
      documentViewMode: DocumentViewMode
      theoryHtml: string
      coreCategoryId: string
    },
  ) => {
    if (a.activeDocumentId !== b.activeDocumentId) return false
    if (a.documentViewMode !== b.documentViewMode) return false
    if (a.theoryHtml !== b.theoryHtml) return false
    if (a.coreCategoryId !== b.coreCategoryId) return false
    if (a.documents.length !== b.documents.length) return false
    if (a.codes.length !== b.codes.length) return false
    if (a.categories.length !== b.categories.length) return false

    for (let i = 0; i < a.documents.length; i += 1) {
      const docA = a.documents[i]
      const docB = b.documents[i]
      if (docA.id !== docB.id) return false
      if (docA.title !== docB.title) return false
      if (docA.text !== docB.text) return false
      if (docA.html !== docB.html) return false
    }

    for (let i = 0; i < a.codes.length; i += 1) {
      const codeA = a.codes[i]
      const codeB = b.codes[i]
      if (codeA.id !== codeB.id) return false
      if (codeA.label !== codeB.label) return false
      if (codeA.description !== codeB.description) return false
      if (codeA.colorHex !== codeB.colorHex) return false
      if (codeA.textHex !== codeB.textHex) return false
      if (codeA.ringHex !== codeB.ringHex) return false
    }

    for (let i = 0; i < a.categories.length; i += 1) {
      const catA = a.categories[i]
      const catB = b.categories[i]
      if (catA.id !== catB.id) return false
      if (catA.name !== catB.name) return false
      if (catA.codeIds.length !== catB.codeIds.length) return false
      for (let j = 0; j < catA.codeIds.length; j += 1) {
        if (catA.codeIds[j] !== catB.codeIds[j]) return false
      }
    }

    return true
  }

  const createSnapshot = () => {
    const payload = {
      documents: documents.map((doc) => ({ ...doc })),
      codes: codes.map((code) => ({ ...code })),
      categories: categories.map((category) => ({ ...category, codeIds: [...category.codeIds] })),
      activeDocumentId,
      documentViewMode,
      theoryHtml,
      coreCategoryId,
    }
    if (typeof structuredClone === 'function') {
      return structuredClone(payload)
    }
    return JSON.parse(JSON.stringify(payload)) as typeof payload
  }

  const pushHistory = () => {
    const snapshot = createSnapshot()
    const past = historyRef.current.past
    const last = past[past.length - 1]
    if (last && isSameSnapshot(last, snapshot)) return
    historyRef.current.past = [...past, snapshot].slice(-60)
    historyRef.current.future = []
  }

  const restoreSnapshot = (snapshot: ReturnType<typeof createSnapshot>) => {
    setDocuments(snapshot.documents)
    setCodes(snapshot.codes)
    setCategories(snapshot.categories)
    setActiveDocumentId(snapshot.activeDocumentId)
    setDocumentViewMode(snapshot.documentViewMode)
    setTheoryHtml(snapshot.theoryHtml)
    setCoreCategoryId(snapshot.coreCategoryId)
  }

  const handleUndo = () => {
    if (executeEditorCommand('undo')) return
    const history = historyRef.current
    if (!history.past.length) return
    const current = createSnapshot()
    const previous = history.past[history.past.length - 1]
    history.past = history.past.slice(0, -1)
    history.future = [current, ...history.future]
    restoreSnapshot(previous)
  }

  const handleRedo = () => {
    if (executeEditorCommand('redo')) return
    const history = historyRef.current
    if (!history.future.length) return
    const current = createSnapshot()
    const next = history.future[0]
    history.future = history.future.slice(1)
    history.past = [...history.past, current]
    restoreSnapshot(next)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return

      const activeElement = document.activeElement as HTMLElement | null
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return
      }

      event.preventDefault()

      if (key === 'z' && event.shiftKey) {
        handleRedo()
        return
      }

      if (key === 'z') {
        handleUndo()
        return
      }

      if (key === 'y') {
        handleRedo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  })

  const highlightPalette = useMemo(
    () => [
      { bg: '#FEF3C7', text: '#92400E' },
      { bg: '#E0F2FE', text: '#075985' },
      { bg: '#D1FAE5', text: '#065F46' },
      { bg: '#FFE4E6', text: '#9F1239' },
      { bg: '#EDE9FE', text: '#5B21B6' },
      { bg: '#FCE7F3', text: '#9D174D' },
      { bg: '#DCFCE7', text: '#166534' },
      { bg: '#FFEDD5', text: '#9A3412' },
    ],
    [],
  )

  const getReadableTextColor = (hex: string) => {
    const value = hex.replace('#', '')
    const r = parseInt(value.slice(0, 2), 16)
    const g = parseInt(value.slice(2, 4), 16)
    const b = parseInt(value.slice(4, 6), 16)
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    return luminance > 0.6 ? '#0F172A' : '#0B1120'
  }

  const getNextPalette = () => {
    const used = new Set(codes.map((code) => code.colorHex))
    const available = highlightPalette.find((palette) => !used.has(palette.bg))
    return available ?? highlightPalette[codes.length % highlightPalette.length]
  }

  const addNewCode = () => {
    pushHistory()
    const palette = getNextPalette()
    const name = `New Code ${codes.length + 1}`
    const newCode: Code = {
      id: `code-${crypto.randomUUID()}`,
      label: name,
      description: 'Custom code',
      colorClass: 'bg-slate-100 text-slate-700 ring-slate-200',
      colorHex: palette.bg,
      textHex: palette.text ?? getReadableTextColor(palette.bg),
      ringHex: `${palette.text ?? '#0F172A'}33`,
    }
    setCodes((current) => [...current, newCode])
  }

  const updateCode = (codeId: string, patch: Partial<Code>) => {
    setCodes((current) => {
      const nextCodes = current.map((code) =>
        code.id === codeId ? { ...code, ...patch } : code,
      )
      const nextCodeMap = new Map(nextCodes.map((code) => [code.id, code]))
      setDocuments((docs) => syncDocumentsForCodes(docs, nextCodeMap))
      syncEditorForCodes(nextCodeMap)
      return nextCodes
    })
  }

  const updateCategory = (categoryId: string, patch: Partial<Category>) => {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, ...patch } : category,
      ),
    )
  }

  const getDocumentById = (documentId: string) =>
    documents.find((doc) => doc.id === documentId)

  const addNewDocument = () => {
    pushHistory()
    const nextIndex = documents.length + 1
    const newDoc: DocumentItem = {
      id: `doc-${crypto.randomUUID()}`,
      title: `Document ${nextIndex}`,
      text: '',
      html: '',
    }
    setDocuments((current) => [...current, newDoc])
    setActiveDocumentId(newDoc.id)
  }

  const removeDocument = (documentId: string) => {
    pushHistory()
    setDocuments((current) => {
      if (current.length <= 1) return current
      const remaining = current.filter((doc) => doc.id !== documentId)
      if (documentId === activeDocumentId && remaining.length) {
        setActiveDocumentId(remaining[0].id)
      }
      return remaining
    })
  }

  const removeCategory = (categoryId: string) => {
    pushHistory()
    setCategories((current) => current.filter((category) => category.id !== categoryId))
  }

  const removeCodeFromCategory = (categoryId: string, codeId: string) => {
    pushHistory()
    setCategories((current) =>
      current.map((category) => {
        if (category.id !== categoryId) return category
        return { ...category, codeIds: category.codeIds.filter((id) => id !== codeId) }
      }),
    )
  }

  const buildProjectState = () => {
    const highlights: Array<{
      id: string
      document_id: string
      start_index: number
      end_index: number
      code_id: string
    }> = []

    const parsedDocuments = documents.map((doc) => {
      if (!doc.html) {
        return { ...doc, content: doc.text }
      }

      const parser = new DOMParser()
      const wrapper = parser.parseFromString(`<div>${doc.html}</div>`, 'text/html')
      const root = wrapper.body.firstElementChild
      if (!root) {
        return { ...doc, content: doc.text }
      }

      let cursor = 0
      const parts: string[] = []
      const shouldIgnore = (element: HTMLElement | null) => {
        if (!element) return false
        return Boolean(
          element.closest('.code-label') ||
            element.closest('.code-remove') ||
            element.closest('[data-non-editable="true"]'),
        )
      }

      const getCodeContentText = (element: HTMLElement) => {
        const content = element.querySelector('.code-content') as HTMLElement | null
        return content?.textContent ?? ''
      }

      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement
          if (shouldIgnore(parent)) return
          const text = node.textContent ?? ''
          parts.push(text)
          cursor += text.length
          return
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return

        const element = node as HTMLElement
        if (shouldIgnore(element)) return

        const codeId = element.getAttribute('data-code-id')
        if (codeId) {
          const text = getCodeContentText(element)
          const start = cursor
          const end = cursor + text.length
          highlights.push({
            id: `hl-${doc.id}-${start}-${end}-${codeId}`,
            document_id: doc.id,
            start_index: start,
            end_index: end,
            code_id: codeId,
          })
          parts.push(text)
          cursor = end
          return
        }

        Array.from(node.childNodes).forEach(walk)
      }

      Array.from(root.childNodes).forEach(walk)

      return {
        ...doc,
        content: parts.join(''),
      }
    })

    return {
      documents: parsedDocuments.map((doc) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content ?? doc.text,
      })),
      codes: codes.map((code) => ({
        id: code.id,
        name: code.label,
        color: code.colorHex ?? '#E2E8F0',
      })),
      highlights,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        contained_code_ids: category.codeIds,
        precondition: category.precondition ?? '',
        action: category.action ?? '',
        consequence: category.consequence ?? '',
      })),
      core_category_id: coreCategoryId || null,
      theory_description: theoryHtml.replace(/<[^>]*>/g, '').trim(),
    }
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const getApiBase = () => {
    if (typeof window === 'undefined') return ''
    if (window.location.port === '5173') return 'http://localhost:8000'
    return window.location.origin
  }

  const handleSaveProject = () => {
    const payload = {
      version: 1,
      documents,
      codes,
      categories,
      coreCategoryId,
      theoryHtml,
      activeDocumentId,
      documentViewMode,
      documentFontFamily,
      documentLineHeight,
      showCodeLabels,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    downloadBlob(blob, 'project_backup.json')
  }

  const handleLoadProject = async (file: File) => {
    const text = await file.text()
    const payload = JSON.parse(text) as {
      version?: number
      documents?: DocumentItem[]
      codes?: Code[]
      categories?: Category[]
      coreCategoryId?: string
      theoryHtml?: string
      activeDocumentId?: string
      documentViewMode?: DocumentViewMode
      documentFontFamily?: string
      documentLineHeight?: string
      showCodeLabels?: boolean
    }

    if (payload.version && payload.documents?.length) {
      setDocuments(payload.documents)
      setActiveDocumentId(payload.activeDocumentId ?? payload.documents[0]?.id ?? 'doc-1')
      if (payload.codes) setCodes(payload.codes)
      if (payload.categories)
        setCategories(
          payload.categories.map((category) => ({
            ...category,
            precondition: category.precondition ?? '',
            action: category.action ?? '',
            consequence: category.consequence ?? '',
          })),
        )
      setCoreCategoryId(payload.coreCategoryId ?? '')
      setTheoryHtml(payload.theoryHtml ?? '')
      if (payload.documentViewMode) setDocumentViewMode(payload.documentViewMode)
      if (payload.documentFontFamily) {
        setDocumentFontFamily(payload.documentFontFamily)
        setDocumentFontFamilyDisplay(payload.documentFontFamily)
      }
      if (payload.documentLineHeight) setDocumentLineHeight(payload.documentLineHeight)
      if (typeof payload.showCodeLabels === 'boolean') setShowCodeLabels(payload.showCodeLabels)
      return
    }

    const legacy = JSON.parse(text) as {
      documents?: Array<{ id: string; title: string; content: string }>
      codes?: Array<{ id: string; name: string; color: string }>
      categories?: Array<{
        id: string
        name: string
        contained_code_ids: string[]
        precondition?: string
        action?: string
        consequence?: string
      }>
      core_category_id?: string | null
      theory_description?: string
    }

    if (legacy.documents?.length) {
      setDocuments(
        legacy.documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          text: doc.content,
          html: '',
        })),
      )
      setActiveDocumentId(legacy.documents[0].id)
    }
    if (legacy.codes) {
      setCodes(
        legacy.codes.map((code) => ({
          id: code.id,
          label: code.name,
          description: 'Imported code',
          colorClass: 'bg-slate-100 text-slate-700 ring-slate-200',
          colorHex: code.color,
          textHex: getReadableTextColor(code.color),
          ringHex: `${getReadableTextColor(code.color)}33`,
        })),
      )
    }
    if (legacy.categories) {
      setCategories(
        legacy.categories.map((category) => ({
          id: category.id,
          name: category.name,
          codeIds: category.contained_code_ids ?? [],
          precondition: category.precondition ?? '',
          action: category.action ?? '',
          consequence: category.consequence ?? '',
        })),
      )
    }
    setCoreCategoryId(legacy.core_category_id ?? '')
    if (legacy.theory_description) {
      setTheoryHtml(legacy.theory_description)
    }
  }

  const exportReport = async (format: 'word' | 'excel') => {
    const payload = buildProjectState()
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    const formData = new FormData()
    formData.append('file', blob, 'project.json')

    const apiBase = getApiBase()

    await fetch(`${apiBase}/project/load`, {
      method: 'POST',
      body: formData,
    })

    const response = await fetch(`${apiBase}/export/${format}`)
    if (!response.ok) return
    const fileBlob = await response.blob()
    downloadBlob(
      fileBlob,
      format === 'word' ? 'grounded_theory_report.docx' : 'grounded_theory_report.xlsx',
    )
  }

  const applyCodeToSelection = (codeId: string) => {
    const selectionRef = window.getSelection()
    const storedRange = selectionRangeRef.current
    const selectionDocumentId = selectionDocumentIdRef.current
    if (!storedRange || storedRange.collapsed || !selectionDocumentId) return

    const codeToApply = codeById.get(codeId)
    if (!codeToApply) return

    pushHistory()

    const range = storedRange
    const span = document.createElement('span')
    span.setAttribute('data-code-id', codeToApply.id)
    span.style.backgroundColor = codeToApply.colorHex ?? '#E2E8F0'
    span.style.color = codeToApply.textHex ?? '#334155'
    span.style.borderRadius = '6px'
    span.style.padding = '0 18px 0 4px'
    span.style.boxShadow = `inset 0 0 0 1px ${
      codeToApply.ringHex ?? 'rgba(148,163,184,0.4)'
    }`
    span.style.position = 'relative'
    span.style.display = 'inline-block'
    span.style.paddingTop = '16px'

    const label = document.createElement('span')
    label.className = 'code-label'
    label.textContent = codeToApply.label
    label.setAttribute('contenteditable', 'false')
    label.setAttribute('data-non-editable', 'true')
    label.style.position = 'absolute'
    label.style.top = '2px'
    label.style.left = '4px'
    label.style.fontSize = '8px'
    label.style.fontWeight = '600'
    label.style.letterSpacing = '0.08em'
    label.style.textTransform = 'uppercase'
    label.style.color = codeToApply.textHex ?? '#475569'
    label.style.backgroundColor = 'transparent'
    label.style.padding = '0'
    label.style.borderRadius = '999px'
    label.style.boxShadow = 'none'
    label.style.display = 'inline-flex'
    label.style.alignItems = 'center'
    label.style.gap = '4px'

    const removeButton = document.createElement('span')
    removeButton.className = 'code-remove'
    removeButton.setAttribute('data-remove-code', 'true')
    removeButton.setAttribute('title', 'Remove highlight')
    removeButton.setAttribute('contenteditable', 'false')
    removeButton.setAttribute('data-non-editable', 'true')
    removeButton.textContent = '×'
    removeButton.style.fontSize = '10px'
    removeButton.style.opacity = '0.6'
    removeButton.style.fontWeight = '700'
    removeButton.style.position = 'absolute'
    removeButton.style.right = '4px'
    removeButton.style.top = '2px'
    removeButton.style.transform = 'none'
    removeButton.style.color = codeToApply.textHex ?? '#0F172A'
    removeButton.style.backgroundColor = 'rgba(255,255,255,0.7)'
    removeButton.style.borderRadius = '999px'
    removeButton.style.padding = '0 4px'
    removeButton.style.lineHeight = '1'
    removeButton.style.zIndex = '2'
    removeButton.style.pointerEvents = 'auto'

    try {
      const fragment = range.extractContents()
      const content = document.createElement('span')
      content.className = 'code-content'
      if (fragment.childNodes.length) {
        content.appendChild(fragment)
      } else {
        content.textContent = range.toString()
      }
      const blockSelectors = 'div,p,li,h1,h2,h3,h4,h5,h6'
      Array.from(content.querySelectorAll(blockSelectors)).forEach((block) => {
        const parent = block.parentNode
        if (!parent) return
        const nextSibling = block.nextSibling
        const fragmentNode = document.createDocumentFragment()
        while (block.firstChild) fragmentNode.appendChild(block.firstChild)
        parent.insertBefore(fragmentNode, block)
        if (nextSibling && nextSibling.nodeName !== 'BR') {
          parent.insertBefore(document.createElement('br'), nextSibling)
        }
        parent.removeChild(block)
      })
      span.appendChild(label)
      span.appendChild(content)
      span.appendChild(removeButton)
      range.insertNode(span)
    } catch {
      const fragment = range.extractContents()
      const content = document.createElement('span')
      content.className = 'code-content'
      if (fragment.childNodes.length) {
        content.appendChild(fragment)
      } else {
        content.textContent = range.toString()
      }
      const blockSelectors = 'div,p,li,h1,h2,h3,h4,h5,h6'
      Array.from(content.querySelectorAll(blockSelectors)).forEach((block) => {
        const parent = block.parentNode
        if (!parent) return
        const nextSibling = block.nextSibling
        const fragmentNode = document.createDocumentFragment()
        while (block.firstChild) fragmentNode.appendChild(block.firstChild)
        parent.insertBefore(fragmentNode, block)
        if (nextSibling && nextSibling.nodeName !== 'BR') {
          parent.insertBefore(document.createElement('br'), nextSibling)
        }
        parent.removeChild(block)
      })
      span.appendChild(label)
      span.appendChild(content)
      span.appendChild(removeButton)
      range.insertNode(span)
    }

    selectionRef?.removeAllRanges()
    selectionRangeRef.current = null
    selectionDocumentIdRef.current = null

    const container = document.querySelector(
      `[data-doc-id="${selectionDocumentId}"] .document-content`,
    ) as HTMLDivElement | null
    if (container) {
      updateDocument(selectionDocumentId, {
        html: container.innerHTML,
        text: container.innerText,
      })
    }
  }

  const removeCode = (codeId: string) => {
    pushHistory()
    setCodes((current) => current.filter((code) => code.id !== codeId))
    setCategories((current) =>
      current.map((category) => ({
        ...category,
        codeIds: category.codeIds.filter((id) => id !== codeId),
      })),
    )

    setDocuments((current) =>
      current.map((doc) => {
        if (!doc.html) return doc
        const container = document.createElement('div')
        container.innerHTML = doc.html
        container.querySelectorAll(`span[data-code-id="${codeId}"]`).forEach((span) => {
          span.replaceWith(document.createTextNode(span.textContent ?? ''))
        })
        return { ...doc, html: container.innerHTML, text: container.innerText }
      }),
    )
  }

  const removeHighlightSpan = (element: HTMLElement) => {
    pushHistory()
    const container = element.closest('[data-doc-id]') as HTMLElement | null
    const documentId = container?.getAttribute('data-doc-id') ?? null
    const content = element.querySelector('.code-content') as HTMLElement | null
    const fallbackText = element.lastChild?.textContent ?? element.textContent ?? ''
    const textNode = document.createTextNode(content?.textContent ?? fallbackText)
    element.replaceWith(textNode)

    const documentContent = container?.querySelector('.document-content') as HTMLDivElement | null
    if (documentId && documentContent) {
      updateDocument(documentId, {
        html: documentContent.innerHTML,
        text: documentContent.innerText,
      })
    }
  }

  const isTheoryEmpty = theoryHtml.replace(/<[^>]*>/g, '').trim().length === 0

  const handleAddCategory = () => {
    pushHistory()
    const id = `category-${crypto.randomUUID()}`
    setCategories((current) => [
      ...current,
      {
        id,
        name: 'New Category',
        codeIds: [],
        precondition: '',
        action: '',
        consequence: '',
      },
    ])
  }

  const activeCode = activeDragId ? codeById.get(activeDragId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <OnboardingTour run={tour.run} runId={tour.runId} onFinish={tour.stop} />
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                  GT
                </div>
                <div>
                  <p className="text-lg font-semibold">Grounded Theory</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        websocketOnline ? 'bg-emerald-500' : 'bg-rose-500',
                      )}
                    />
                    <span>{websocketOnline ? 'Online' : 'Offline'} WebSocket</span>
                  </div>
                </div>
              </div>
              <MenuBar
                onLoadProject={() => fileInputRef.current?.click()}
                onSaveProject={handleSaveProject}
                onExportExcel={() => void exportReport('excel')}
                onExportWord={() => void exportReport('word')}
                onAddDocument={addNewDocument}
                onDeleteDocument={() => removeDocument(activeDocumentId)}
                canDeleteDocument={documents.length > 1}
                deleteDocumentLabel={getDocumentById(activeDocumentId)?.title ?? 'Untitled document'}
                onRenameUser={handleRenameUser}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onCut={() => executeEditorCommand('cut')}
                onCopy={() => executeEditorCommand('copy')}
                onPaste={pasteFromClipboard}
                onSelectAll={() => executeEditorCommand('selectAll')}
                onToggleCodeLabels={() => setShowCodeLabels((current) => !current)}
                showCodeLabels={showCodeLabels}
                onTour={tour.restart}
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {presenceUsers.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: user.color }}
                    />
                    <span className="font-semibold text-slate-600">
                      {user.name}
                      {localUser?.id === user.id ? ' (you)' : ''}
                    </span>
                  </span>
                ))}
                {!presenceUsers.length && (
                  <span className="text-xs text-slate-400">No collaborators yet</span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void handleLoadProject(file)
                  }
                  event.target.value = ''
                }}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[3fr_2fr]">
        <style>{`
          .hide-code-labels .code-label {
            display: none !important;
          }

          .hide-code-labels span[data-code-id] {
            padding-top: 0 !important;
          }

          .code-remove {
            cursor: pointer;
            line-height: 1;
          }

          .document-content,
          .document-content * {
            font-family: inherit !important;
            line-height: inherit !important;
          }

          .document-content {
            white-space: pre-wrap;
          }

          .document-content span[data-code-id] {
            white-space: pre-wrap;
          }

          .document-content h1,
          .document-content h2,
          .document-content h3,
          .document-content h4,
          .document-content h5,
          .document-content h6 {
            font-weight: 700;
          }
        `}</style>
        <section className="space-y-4">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Document Viewer</p>
              <h2 className="text-xl font-semibold text-slate-900">Interview Transcript</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                id="document-view-mode"
                name="document-view-mode"
                value={documentViewMode === 'all' ? '__all__' : activeDocumentId}
                onChange={(event) => {
                  const nextValue = event.target.value
                  if (nextValue === '__all__') {
                    setDocumentViewMode('all')
                    return
                  }
                  setDocumentViewMode('single')
                  setActiveDocumentId(nextValue)
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
              >
                <option value="__all__">All documents</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))}
              </select>
              <input
                id="document-title"
                name="document-title"
                value={getDocumentById(activeDocumentId)?.title ?? ''}
                onChange={(event) => updateDocument(activeDocumentId, { title: event.target.value })}
                className="min-w-[160px] rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
                placeholder="Document title"
              />
            </div>
          </div>

          <div
            id="document-viewer"
            className={cn(
              'relative rounded-2xl bg-white p-8 shadow-sm',
              documentViewMode === 'single' && 'border border-slate-200',
              !showCodeLabels && 'hide-code-labels',
            )}
          >
            {documentViewMode === 'all' ? (
              <div className="space-y-10">
                {documents.map((doc, index) => (
                  <div key={doc.id} className="space-y-3" data-doc-id={doc.id}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                        {doc.title}
                      </p>
                      <span className="text-xs text-slate-400">Document {index + 1}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white">
                      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => document.execCommand('bold', false)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Bold
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => document.execCommand('italic', false)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Italic
                        </button>
                        <select
                          id={`all-doc-font-size-${doc.id}`}
                          name={`all-doc-font-size-${doc.id}`}
                          onChange={(event) =>
                            document.execCommand('fontSize', false, event.target.value)
                          }
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                          defaultValue="3"
                        >
                          <option value="2">Small</option>
                          <option value="3">Normal</option>
                          <option value="4">Large</option>
                          <option value="5">XL</option>
                        </select>
                        <select
                          id={`all-doc-font-family-${doc.id}`}
                          name={`all-doc-font-family-${doc.id}`}
                          value={documentFontFamilyDisplay}
                          onChange={(event) => {
                            setDocumentFontFamily(event.target.value)
                            setDocumentFontFamilyDisplay(event.target.value)
                            document.execCommand('fontName', false, event.target.value)
                          }}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                        >
                          <option value="__mixed__" disabled>
                            Mixed
                          </option>
                          <option value="Inter, ui-sans-serif, system-ui">Inter</option>
                          <option value="Arial, Helvetica, sans-serif">Arial</option>
                          <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">
                            Helvetica Neue
                          </option>
                          <option value="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif">
                            Segoe UI
                          </option>
                          <option value="Roboto, 'Helvetica Neue', Arial, sans-serif">Roboto</option>
                          <option value="'Open Sans', Arial, sans-serif">Open Sans</option>
                          <option value="Lato, Arial, sans-serif">Lato</option>
                          <option value="'Montserrat', Arial, sans-serif">Montserrat</option>
                          <option value="'Noto Sans', Arial, sans-serif">Noto Sans</option>
                          <option value="'Source Sans Pro', Arial, sans-serif">
                            Source Sans Pro
                          </option>
                          <option value="'Times New Roman', Times, serif">Times New Roman</option>
                          <option value="Georgia, serif">Georgia</option>
                          <option value="Garamond, 'Times New Roman', serif">Garamond</option>
                          <option value="'Palatino Linotype', 'Book Antiqua', Palatino, serif">
                            Palatino
                          </option>
                          <option value="'Book Antiqua', 'Palatino Linotype', serif">
                            Book Antiqua
                          </option>
                          <option value="'Courier New', Courier, monospace">Courier New</option>
                          <option value="'Lucida Console', Monaco, monospace">Lucida Console</option>
                          <option value="'Consolas', 'Courier New', monospace">Consolas</option>
                          <option value="'Tahoma', Geneva, sans-serif">Tahoma</option>
                          <option value="'Verdana', Geneva, sans-serif">Verdana</option>
                        </select>
                        <select
                          id={`all-doc-line-height-${doc.id}`}
                          name={`all-doc-line-height-${doc.id}`}
                          value={documentLineHeight}
                          onChange={(event) => setDocumentLineHeight(event.target.value)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                        >
                          <option value="1.4">Tight</option>
                          <option value="1.6">Normal</option>
                          <option value="1.75">Relaxed</option>
                          <option value="2">Loose</option>
                        </select>
                      </div>
                      <div
                        className="document-content prose prose-slate max-w-none p-4 text-sm outline-none"
                        style={{
                          fontFamily: documentFontFamily,
                          lineHeight: documentLineHeight,
                        }}
                        spellCheck={false}
                        ref={(node) => {
                          if (!node) return
                          const html = doc.html || doc.text
                          if (node.innerHTML !== html) {
                            node.innerHTML = html
                          }
                        }}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(event) => {
                          const html = (event.target as HTMLDivElement).innerHTML
                          updateDocument(doc.id, {
                            html,
                            text: (event.target as HTMLDivElement).innerText,
                          })
                        }}
                        onMouseDown={handleHighlightMouseDown}
                        onMouseUp={handleSelection}
                        onClick={(event) => {
                          const removeButton = getClosestRemoveButton(event.target)
                          if (!removeButton) return
                          const highlight = removeButton.closest('span[data-code-id]') as HTMLElement | null
                          if (!highlight) return
                          event.preventDefault()
                          event.stopPropagation()
                          removeHighlightSpan(highlight)
                        }}
                      />
                    </div>
                    {index < documents.length - 1 && (
                      <div className="border-b border-dashed border-slate-200" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4" data-doc-id={activeDocumentId}>
                <DocumentEditor
                  onCommand={applyDocumentCommand}
                  onInput={(event) => {
                    const html = (event.target as HTMLDivElement).innerHTML
                    updateDocument(activeDocumentId, {
                      html,
                      text: (event.target as HTMLDivElement).innerText,
                    })
                  }}
                  onPaste={() => {
                    return
                  }}
                  onMouseDown={handleHighlightMouseDown}
                  onMouseUp={handleSelection}
                  onClick={(event) => {
                    const removeButton = getClosestRemoveButton(event.target)
                    if (!removeButton) return
                    const highlight = removeButton.closest('span[data-code-id]') as HTMLElement | null
                    if (!highlight) return
                    event.preventDefault()
                    event.stopPropagation()
                    removeHighlightSpan(highlight)
                  }}
                  editorRef={(node) => {
                    documentEditorRef.current = node
                  }}
                  fontFamily={documentFontFamily}
                  fontFamilyValue={documentFontFamilyDisplay}
                  lineHeight={documentLineHeight}
                  setFontFamily={(value) => {
                    setDocumentFontFamily(value)
                    setDocumentFontFamilyDisplay(value)
                  }}
                  setLineHeight={setDocumentLineHeight}
                />
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex gap-2">
              {tabConfig.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    id={tab.key === 'axial' ? 'axial-tab' : tab.key === 'theory' ? 'theory-tab' : undefined}
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
                      activeTab === tab.key
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <AnimatePresence mode="wait">
              {activeTab === 'open' ? (
                <motion.div
                  key="open-coding"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Open Codes</p>
                      <p className="text-xs text-slate-500">Drag to axial categories or apply in the document.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addNewCode}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New Code
                    </button>
                  </div>
                  <div className="space-y-2">
                    {codes.map((code) => (
                      <div
                        key={code.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => applyCodeToSelection(code.id)}
                          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: code.colorHex ?? '#E2E8F0',
                            color: code.textHex ?? '#0F172A',
                            boxShadow: `inset 0 0 0 1px ${code.ringHex ?? 'rgba(148,163,184,0.4)'}`,
                          }}
                        >
                          <Tag className="h-3 w-3" />
                          Apply
                        </button>
                        <input
                          id={`code-label-${code.id}`}
                          name={`code-label-${code.id}`}
                          value={code.label}
                          onChange={(event) => updateCode(code.id, { label: event.target.value })}
                          className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                          placeholder="Code name"
                        />
                        <input
                          id={`code-color-${code.id}`}
                          name={`code-color-${code.id}`}
                          type="color"
                          value={code.colorHex ?? '#E2E8F0'}
                          onChange={(event) => {
                            const colorHex = event.target.value
                            updateCode(code.id, {
                              colorHex,
                              textHex: getReadableTextColor(colorHex),
                              ringHex: `${getReadableTextColor(colorHex)}33`,
                            })
                          }}
                          className="h-9 w-12 rounded border border-slate-200"
                          title="Change color"
                        />
                        <button
                          type="button"
                          onClick={() => removeCode(code.id)}
                          className="rounded-lg border border-slate-200 px-2 py-2 text-slate-500 transition hover:bg-slate-50"
                          title="Remove code"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {!codes.length && (
                      <p className="text-xs text-slate-400">Create your first code to start tagging text.</p>
                    )}
                  </div>
                </motion.div>
              ) : activeTab === 'axial' ? (
                <motion.div
                  key="axial-coding"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Axial Categories</p>
                      <p className="text-xs text-slate-500">Group codes into higher-level themes.</p>
                    </div>
                    <button
                      onClick={handleAddCategory}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New Category
                    </button>
                  </div>

                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ungrouped Codes</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <SortableContext items={ungroupedCodes.map((code) => code.id)}>
                        {ungroupedCodes.map((code) => (
                          <CodeChip key={code.id} code={code} onRemove={removeCode} />
                        ))}
                      </SortableContext>
                    </div>
                    {!ungroupedCodes.length && (
                      <p className="mt-2 text-xs text-slate-400">All codes are grouped.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    {categories.map((category) => (
                      <CategoryCard
                        key={category.id}
                        category={category}
                        codes={codes}
                        onUpdate={updateCategory}
                        onRemove={removeCategory}
                        onRemoveCode={removeCodeFromCategory}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="selective-coding"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="space-y-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Selective Coding</p>
                    <p className="text-xs text-slate-500">
                      Define your core category and craft the final grounded theory narrative.
                    </p>
                  </div>
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <label
                        htmlFor="core-category"
                        className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                      >
                        Core Category
                      </label>
                      <select
                        id="core-category"
                        name="core-category"
                        value={coreCategoryId}
                        onChange={(event) => setCoreCategoryId(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                      >
                        <option value="">Select the core category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Categories & Codes Overview
                      </p>
                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        {categories.length ? (
                          categories.map((category) => (
                            <div
                              key={category.id}
                              className="rounded-lg border border-slate-200 bg-white p-3"
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-slate-800">
                                  {category.name}
                                </p>
                                {coreCategoryId === category.id ? (
                                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                    Core
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {category.codeIds.length ? (
                                  category.codeIds
                                    .map((codeId) => codeById.get(codeId))
                                    .filter((code): code is Code => Boolean(code))
                                    .map((code) => (
                                      <span
                                        key={code.id}
                                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                                        style={{
                                          backgroundColor: code.colorHex ?? '#E2E8F0',
                                          color: code.textHex ?? '#0F172A',
                                          boxShadow: `inset 0 0 0 1px ${
                                            code.ringHex ?? 'rgba(148,163,184,0.4)'
                                          }`,
                                        }}
                                      >
                                        {code.label}
                                      </span>
                                    ))
                                ) : (
                                  <span className="text-xs text-slate-400">No codes yet</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-400">
                            Add categories and codes to see the overview here.
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label
                        id="theory-narrative-label"
                        htmlFor="theory-narrative"
                        className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                      >
                        Theory Narrative
                      </label>
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white">
                        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => applyEditorCommand('bold')}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            Bold
                          </button>
                          <button
                            type="button"
                            onClick={() => applyEditorCommand('italic')}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            Italic
                          </button>
                          <button
                            type="button"
                            onClick={() => applyEditorCommand('underline')}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            Underline
                          </button>
                          <select
                            id="theory-font-size"
                            name="theory-font-size"
                            onChange={(event) => applyEditorCommand('fontSize', event.target.value)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                            defaultValue="3"
                          >
                            <option value="2">Small</option>
                            <option value="3">Normal</option>
                            <option value="4">Large</option>
                            <option value="5">XL</option>
                          </select>
                          <input
                            id="theory-text-color"
                            name="theory-text-color"
                            type="color"
                            onChange={(event) => applyEditorCommand('foreColor', event.target.value)}
                            className="h-7 w-10 rounded border border-slate-200"
                            title="Text color"
                          />
                        </div>
                        <div className="relative">
                          {isTheoryEmpty && (
                            <span className="pointer-events-none absolute left-3 top-3 text-sm text-slate-400">
                              Summarize the main storyline and how categories relate...
                            </span>
                          )}
                          <div
                            ref={theoryEditorRef}
                            id="theory-narrative"
                            role="textbox"
                            aria-multiline="true"
                            aria-labelledby="theory-narrative-label"
                            className="min-h-[140px] px-3 py-3 text-sm text-slate-700 outline-none"
                            contentEditable
                            suppressContentEditableWarning
                            onInput={(event) =>
                              setTheoryHtml((event.target as HTMLDivElement).innerHTML)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>
        </main>

        <div className="pointer-events-none fixed inset-0 z-50">
          {Object.entries(remoteCursors).map(([userId, cursor]) => {
            if (localUser?.id === userId) return null
            const user = presenceById.get(userId)
            if (!user) return null
            return (
              <div
                key={userId}
                className="absolute"
                style={{ left: cursor.x, top: cursor.y }}
              >
                <div
                  className="h-5 w-0.5"
                  style={{ backgroundColor: user.color }}
                />
                <div
                  className="-mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name}
                </div>
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {activeCode ? (
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset shadow-sm',
                activeCode.colorClass,
              )}
              style={{
                backgroundColor: activeCode.colorHex ?? undefined,
                color: activeCode.textHex ?? undefined,
                boxShadow: activeCode.ringHex
                  ? `inset 0 0 0 1px ${activeCode.ringHex}`
                  : undefined,
              }}
            >
              <Tag className="h-3 w-3" />
              {activeCode.label}
            </span>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
