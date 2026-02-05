import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Cloud,
  CloudOff,
  FileDown,
  Plus,
  Save,
  Tag,
  Upload,
  Layers,
  ChevronDown,
  Trash2,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '../lib/cn'
import { type Category, type Code } from '../data/mockData'
import { OnboardingTour } from './OnboardingTour'
import { useOnboardingTour } from '../hooks/useOnboardingTour'
import { useProjectWebSocket } from '../hooks/useProjectWebSocket.ts'

type TabKey = 'open' | 'axial' | 'theory'
type DocumentViewMode = 'single' | 'all'

type DocumentItem = {
  id: string
  title: string
  text: string
  html: string
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
      }
    } catch {
      return null
    }
  }
  const storedState = loadStoredState()
  const [activeTab, setActiveTab] = useState<TabKey>('open')
  const [codes, setCodes] = useState<Code[]>(() => storedState?.codes ?? [])
  const [categories, setCategories] = useState<Category[]>(() => storedState?.categories ?? [])
  const { isOnline: websocketOnline } = useProjectWebSocket()
  const [isEditingDocument, setIsEditingDocument] = useState(false)
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
  const documentContentRef = useRef<HTMLDivElement | null>(null)
  const selectionRangeRef = useRef<Range | null>(null)
  const selectionDocumentIdRef = useRef<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const theoryEditorRef = useRef<HTMLDivElement | null>(null)
  const [theoryHtml, setTheoryHtml] = useState(() => storedState?.theoryHtml ?? '')
  const tour = useOnboardingTour()

  useEffect(() => {
    const payload = JSON.stringify({
      codes,
      categories,
      documents,
      activeDocumentId,
      documentViewMode,
      theoryHtml,
    })
    localStorage.setItem(storageKey, payload)
  }, [codes, categories, documents, activeDocumentId, documentViewMode, theoryHtml])

  const codeById = useMemo(() => {
    return new Map(codes.map((code) => [code.id, code]))
  }, [codes])

  const assignedCodeIds = useMemo(() => {
    return new Set(categories.flatMap((category) => category.codeIds))
  }, [categories])

  const ungroupedCodes = useMemo(() => {
    return codes.filter((code) => !assignedCodeIds.has(code.id))
  }, [codes, assignedCodeIds])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleSelection = () => {
    if (isEditingDocument) return
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
    const palette = getNextPalette()
    const name = `New Code ${codes.length + 1}`
    const newCode: Code = {
      id: `code-${Date.now()}`,
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
    setCodes((current) =>
      current.map((code) => (code.id === codeId ? { ...code, ...patch } : code)),
    )
  }

  const updateCategory = (categoryId: string, patch: Partial<Category>) => {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, ...patch } : category,
      ),
    )
  }

  const updateDocument = (documentId: string, patch: Partial<DocumentItem>) => {
    setDocuments((current) =>
      current.map((doc) => (doc.id === documentId ? { ...doc, ...patch } : doc)),
    )
  }

  const getDocumentById = (documentId: string) =>
    documents.find((doc) => doc.id === documentId)

  const getSelectionDocumentId = (range: Range) => {
    const node = range.commonAncestorContainer
    const element = node instanceof HTMLElement ? node : node.parentElement
    const container = element?.closest('[data-doc-id]')
    return container?.getAttribute('data-doc-id') ?? null
  }

  const addNewDocument = () => {
    const nextIndex = documents.length + 1
    const newDoc: DocumentItem = {
      id: `doc-${Date.now()}`,
      title: `Document ${nextIndex}`,
      text: '',
      html: '',
    }
    setDocuments((current) => [...current, newDoc])
    setActiveDocumentId(newDoc.id)
    setIsEditingDocument(true)
  }

  const removeDocument = (documentId: string) => {
    setDocuments((current) => {
      if (current.length <= 1) return current
      const remaining = current.filter((doc) => doc.id !== documentId)
      if (documentId === activeDocumentId && remaining.length) {
        setActiveDocumentId(remaining[0].id)
        setIsEditingDocument(false)
      }
      return remaining
    })
  }

  const removeCategory = (categoryId: string) => {
    setCategories((current) => current.filter((category) => category.id !== categoryId))
  }

  const removeCodeFromCategory = (categoryId: string, codeId: string) => {
    setCategories((current) =>
      current.map((category) => {
        if (category.id !== categoryId) return category
        return { ...category, codeIds: category.codeIds.filter((id) => id !== codeId) }
      }),
    )
  }

  const handleToggleEdit = () => {
    if (isEditingDocument) {
      const editor = documentEditorRef.current
      if (editor) {
        updateDocument(activeDocumentId, {
          html: editor.innerHTML,
          text: editor.innerText,
        })
      }
      setIsEditingDocument(false)
      return
    }

    const viewer = documentContentRef.current
    if (viewer) {
      updateDocument(activeDocumentId, {
        html: viewer.innerHTML,
        text: viewer.innerText,
      })
    }
    setIsEditingDocument(true)
  }

  const applyCodeToSelection = (codeId: string) => {
    const selectionRef = window.getSelection()
    const storedRange = selectionRangeRef.current
    const selectionDocumentId = selectionDocumentIdRef.current
    if (!storedRange || storedRange.collapsed || !selectionDocumentId) return

    const codeToApply = codeById.get(codeId)
    if (!codeToApply) return

    const range = storedRange
    const span = document.createElement('span')
    span.setAttribute('data-code-id', codeToApply.id)
    span.style.backgroundColor = codeToApply.colorHex ?? '#E2E8F0'
    span.style.color = codeToApply.textHex ?? '#334155'
    span.style.borderRadius = '6px'
    span.style.padding = '0 4px'
    span.style.boxShadow = `inset 0 0 0 1px ${
      codeToApply.ringHex ?? 'rgba(148,163,184,0.4)'
    }`

    try {
      range.surroundContents(span)
    } catch {
      const text = range.toString()
      span.textContent = text
      range.deleteContents()
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
    if (isEditingDocument) return
    const container = element.closest('[data-doc-id]') as HTMLElement | null
    const documentId = container?.getAttribute('data-doc-id') ?? null
    const textNode = document.createTextNode(element.textContent ?? '')
    element.replaceWith(textNode)

    const content = container?.querySelector('.document-content') as HTMLDivElement | null
    if (documentId && content) {
      updateDocument(documentId, {
        html: content.innerHTML,
        text: content.innerText,
      })
    }
  }

  const isTheoryEmpty = theoryHtml.replace(/<[^>]*>/g, '').trim().length === 0

  const handleAddCategory = () => {
    const id = `category-${Date.now()}`
    setCategories((current) => [
      ...current,
      {
        id,
        name: 'New Category',
        codeIds: [],
      },
    ])
  }

  const activeCode = activeDragId ? codeById.get(activeDragId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <OnboardingTour run={tour.run} onFinish={tour.stop} />
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
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
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Project Actions</p>
              <div className="flex items-center gap-3">
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
                  onClick={tour.restart}
                >
                  Help / Restart Tour
                </button>
                <input ref={fileInputRef} type="file" className="hidden" />
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Load Project
                </button>
                <div id="export-actions" className="relative flex items-center gap-3">
                  <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300">
                    <Save className="h-4 w-4" />
                    Save Project
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
                    onClick={() => setExportOpen((prev) => !prev)}
                  >
                    <FileDown className="h-4 w-4" />
                    Export Report
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <AnimatePresence>
                    {exportOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-lg"
                      >
                        <button className="w-full rounded-lg px-3 py-2 text-left text-slate-600 transition hover:bg-slate-50">
                          Export as Excel
                        </button>
                        <button className="w-full rounded-lg px-3 py-2 text-left text-slate-600 transition hover:bg-slate-50">
                          Export as Word
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[3fr_2fr]">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Document Viewer</p>
              <h2 className="text-xl font-semibold text-slate-900">Interview Transcript</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                <button
                  type="button"
                  onClick={() => setDocumentViewMode('single')}
                  className={cn(
                    'rounded-full px-2 py-0.5 transition',
                    documentViewMode === 'single'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:bg-slate-100',
                  )}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentViewMode('all')}
                  className={cn(
                    'rounded-full px-2 py-0.5 transition',
                    documentViewMode === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:bg-slate-100',
                  )}
                >
                  All
                </button>
              </div>
              <select
                value={activeDocumentId}
                onChange={(event) => setActiveDocumentId(event.target.value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
              >
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))}
              </select>
              <input
                value={getDocumentById(activeDocumentId)?.title ?? ''}
                onChange={(event) => updateDocument(activeDocumentId, { title: event.target.value })}
                className="min-w-[160px] rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
                placeholder="Document title"
              />
              <button
                type="button"
                onClick={addNewDocument}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
              >
                + New
              </button>
              <button
                type="button"
                onClick={() => removeDocument(activeDocumentId)}
                disabled={documents.length <= 1}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={handleToggleEdit}
                disabled={documentViewMode === 'all'}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
              >
                {isEditingDocument ? 'Done Editing' : 'Edit Transcript'}
              </button>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                {websocketOnline ? (
                  <Cloud className="h-3.5 w-3.5" />
                ) : (
                  <CloudOff className="h-3.5 w-3.5" />
                )}
                Autosave Ready
              </div>
            </div>
          </div>

          <div
            id="document-viewer"
            className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            {documentViewMode === 'single' ? (
              <div className="space-y-4" data-doc-id={activeDocumentId}>
                {isEditingDocument ? (
                  <div className="rounded-xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => applyDocumentCommand('bold')}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Bold
                      </button>
                      <button
                        type="button"
                        onClick={() => applyDocumentCommand('italic')}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Italic
                      </button>
                      <select
                        onChange={(event) => applyDocumentCommand('fontSize', event.target.value)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                        defaultValue="3"
                      >
                        <option value="2">Small</option>
                        <option value="3">Normal</option>
                        <option value="4">Large</option>
                        <option value="5">XL</option>
                      </select>
                    </div>
                    <div
                      ref={(node) => {
                        documentEditorRef.current = node
                        documentContentRef.current = node
                      }}
                      className="document-content min-h-[220px] whitespace-pre-wrap px-3 py-3 text-sm leading-7 text-slate-800 outline-none"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(event) => {
                        const html = (event.target as HTMLDivElement).innerHTML
                        updateDocument(activeDocumentId, {
                          html,
                          text: (event.target as HTMLDivElement).innerText,
                        })
                      }}
                      dangerouslySetInnerHTML={{
                        __html:
                          getDocumentById(activeDocumentId)?.html ||
                          getDocumentById(activeDocumentId)?.text.replace(/\n/g, '<br />') ||
                          '',
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="document-content prose prose-slate max-w-none text-sm leading-7"
                    onMouseUp={handleSelection}
                    onClick={(event) => {
                      const target = event.target as HTMLElement | null
                      if (!target) return
                      if (target.matches('span[data-code-id]')) {
                        event.preventDefault()
                        event.stopPropagation()
                        removeHighlightSpan(target)
                      }
                    }}
                  >
                    {getDocumentById(activeDocumentId)?.html ? (
                      <div
                        ref={documentContentRef}
                        dangerouslySetInnerHTML={{ __html: getDocumentById(activeDocumentId)?.html ?? '' }}
                      />
                    ) : (
                      <div ref={documentContentRef}>{getDocumentById(activeDocumentId)?.text ?? ''}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-10">
                {documents.map((doc, index) => (
                  <div key={doc.id} className="space-y-3" data-doc-id={doc.id}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                        {doc.title}
                      </p>
                      <span className="text-xs text-slate-400">Document {index + 1}</span>
                    </div>
                    <div
                      className="document-content prose prose-slate max-w-none text-sm leading-7"
                      onMouseUp={handleSelection}
                      onClick={(event) => {
                        const target = event.target as HTMLElement | null
                        if (!target) return
                        if (target.matches('span[data-code-id]')) {
                          event.preventDefault()
                          event.stopPropagation()
                          removeHighlightSpan(target)
                        }
                      }}
                    >
                      {doc.html ? (
                        <div dangerouslySetInnerHTML={{ __html: doc.html }} />
                      ) : (
                        <div>{doc.text}</div>
                      )}
                    </div>
                    {index < documents.length - 1 && (
                      <div className="border-b border-dashed border-slate-200" />
                    )}
                  </div>
                ))}
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
                          value={code.label}
                          onChange={(event) => updateCode(code.id, { label: event.target.value })}
                          className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                          placeholder="Code name"
                        />
                        <input
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
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Core Category
                      </label>
                      <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        <option>Select the core category</option>
                        {categories.map((category) => (
                          <option key={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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
                            className="min-h-[140px] px-3 py-3 text-sm text-slate-700 outline-none"
                            contentEditable
                            suppressContentEditableWarning
                            onInput={(event) =>
                              setTheoryHtml((event.target as HTMLDivElement).innerHTML)
                            }
                            dangerouslySetInnerHTML={{ __html: theoryHtml }}
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

function CodeChip({
  code,
  onRemove,
}: {
  code: Code
  onRemove?: (codeId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: code.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <motion.span
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: code.colorHex ?? undefined,
        color: code.textHex ?? undefined,
        boxShadow: code.ringHex
          ? `inset 0 0 0 1px ${code.ringHex}`
          : undefined,
      }}
      {...attributes}
      {...listeners}
      whileHover={{ y: -2 }}
      className={cn(
        'inline-flex cursor-grab items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset shadow-sm transition',
        code.colorClass,
        isDragging && 'opacity-60',
      )}
    >
      <Tag className="h-3 w-3" />
      {code.label}
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove(code.id)
          }}
          className="ml-1 rounded-full p-0.5 text-slate-500 transition hover:bg-white/70"
          title="Remove code"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </motion.span>
  )
}

function CategoryCard({
  category,
  codes,
  onUpdate,
  onRemove,
  onRemoveCode,
}: {
  category: Category
  codes: Code[]
  onUpdate: (categoryId: string, patch: Partial<Category>) => void
  onRemove: (categoryId: string) => void
  onRemoveCode: (categoryId: string, codeId: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: category.id,
  })

  const assignedCodes = category.codeIds
    .map((codeId) => codes.find((code) => code.id === codeId))
    .filter((code): code is Code => Boolean(code))

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition',
        isOver && 'border-slate-400 bg-slate-50',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={category.name}
          onChange={(event) => onUpdate(category.id, { name: event.target.value })}
          className="min-w-[160px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
        />
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {assignedCodes.length} codes
          </span>
          <button
            type="button"
            onClick={() => onRemove(category.id)}
            className="rounded-lg border border-slate-200 px-2 py-2 text-slate-500 transition hover:bg-slate-50"
            title="Delete category"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {assignedCodes.length ? (
          <SortableContext items={assignedCodes.map((code) => code.id)}>
            {assignedCodes.map((code) => (
              <CodeChip
                key={code.id}
                code={code}
                onRemove={(codeId) => onRemoveCode(category.id, codeId)}
              />
            ))}
          </SortableContext>
        ) : (
          <span className="text-xs text-slate-400">Drop codes here</span>
        )}
      </div>
    </div>
  )
}
