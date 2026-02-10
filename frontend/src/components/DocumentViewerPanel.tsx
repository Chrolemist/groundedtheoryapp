import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import type { Doc } from 'yjs'
import type { Editor } from '@tiptap/react'
import { type Category, type Code, type Memo } from '../types'
import { type DocumentItem, type DocumentViewMode } from './DashboardLayout.types'
import { DocumentEditor } from './DocumentEditor'
import { useYjsMapText } from '../hooks/useYjsMapText'
import { cn } from '../lib/cn'
import { TreeMapView, type TreeMapExcerptTarget } from './TreeMapView'
import { StatsOverviewPanel } from './StatsOverviewPanel'
import './DocumentViewerPanel.css'

type DocumentViewerPanelProps = {
  documents: DocumentItem[]
  codes: Code[]
  categories: Category[]
  memos: Memo[]
  coreCategoryId: string
  showMemos: boolean
  theoryHtml: string
  projectName: string
  onProjectNameChange?: (name: string) => void
  ydoc: Doc
  activeDocumentId: string
  documentViewMode: DocumentViewMode
  onDocumentViewModeChange: (value: DocumentViewMode) => void
  onActiveDocumentChange: (documentId: string) => void
  onRemoveDocument: (documentId: string, documentTitle: string) => void
  documentTitle: string
  onDocumentTitleChange: (title: string) => void
  documentFontFamily: string
  documentFontFamilyDisplay: string
  onDocumentFontFamilyChange: (value: string) => void
  onDocumentFontFamilyDisplayChange: (value: string) => void
  documentLineHeight: string
  onDocumentLineHeightChange: (value: string) => void
  showCodeLabels: boolean
  onAddDocument: () => void
  onMoveDocument: (documentId: string, direction: 'up' | 'down') => void
  onDocumentInput: (documentId: string, patch: { html: string; text: string }) => void
  onEditorReady: (documentId: string, editor: Editor | null) => void
  onHighlightMouseDown: (event: MouseEvent<HTMLElement>) => void
  onHighlightMouseUp: () => void
  onHighlightClick: (event: MouseEvent<HTMLElement>) => void
  onEditorRef: (node: HTMLDivElement | null) => void
  canSeedInitialContent: boolean
  seedReady: boolean
  hasRemoteUpdates: boolean
  hasReceivedSync: boolean
  isolationMode?: boolean
  plainEditorMode?: boolean
}

export function DocumentViewerPanel({
  documents,
  codes,
  categories,
  memos,
  coreCategoryId,
  showMemos,
  theoryHtml,
  projectName,
  onProjectNameChange,
  ydoc,
  activeDocumentId,
  documentViewMode,
  onDocumentViewModeChange,
  onActiveDocumentChange,
  onRemoveDocument,
  documentTitle,
  onDocumentTitleChange,
  documentFontFamily,
  documentFontFamilyDisplay,
  onDocumentFontFamilyChange,
  onDocumentFontFamilyDisplayChange,
  documentLineHeight,
  onDocumentLineHeightChange,
  showCodeLabels,
  onAddDocument,
  onMoveDocument,
  onDocumentInput,
  onEditorReady,
  onHighlightMouseDown,
  onHighlightMouseUp,
  onHighlightClick,
  onEditorRef,
  canSeedInitialContent,
  seedReady,
  hasRemoteUpdates,
  hasReceivedSync,
  isolationMode = false,
  plainEditorMode = false,
}: DocumentViewerPanelProps) {
    const collaborationEnabled = !isolationMode && !plainEditorMode
  const debugDisableEditors = false
  const hasDocuments = documents.length > 0
  const codeById = useMemo(() => new Map(codes.map((code) => [code.id, code])), [codes])

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const isEffectivelyEmptyHtml = (value: string) => {
    const html = (value ?? '').trim()
    if (!html) return true
    try {
      const container = document.createElement('div')
      container.innerHTML = html
      container.querySelectorAll('[data-remove-code], .code-remove, .code-label').forEach((node) =>
        node.remove(),
      )
      const text = (container.textContent ?? '').replace(/\u00A0/g, ' ').trim()
      return text.length === 0
    } catch {
      // If parsing fails, treat as non-empty to avoid hiding content.
      return false
    }
  }

  const toInitialHtml = (doc: DocumentItem | undefined) => {
    if (!doc) return ''
    const html = (doc.html ?? '').trim()
    const text = doc.text ?? ''
    if (!text.trim()) return ''
    // If HTML exists but is effectively empty (e.g. '<p></p>'), prefer text so we don't
    // seed the editor with empty HTML and accidentally overwrite a valid `text` payload.
    if (html && !isEffectivelyEmptyHtml(html)) return html
    // TipTap expects HTML content. Convert plain text into a minimal HTML representation.
    return `<p>${escapeHtml(text).replace(/\n/g, '<br />')}</p>`
  }
  const [activeTab, setActiveTab] = useState<'document' | 'tree' | 'overview'>(
    'document',
  )
  const updateDocumentTitle = useYjsMapText({
    ydoc,
    mapName: 'documents',
    itemId: activeDocumentId,
    field: 'title',
    onLocalUpdate: onDocumentTitleChange,
  })
  const [isEditingProjectName, setIsEditingProjectName] = useState(false)
  const [projectNameDraft, setProjectNameDraft] = useState(projectName)
  const canRenameProject = Boolean(onProjectNameChange)
  const displayProjectName = projectName.trim() || 'Untitled project'
  const [deferEditorMount, setDeferEditorMount] = useState(false)
  const deferTimerRef = useRef<number | null>(null)
  const mapFocusRef = useRef<HTMLElement | null>(null)
  const skipNextClearRef = useRef(false)
  const focusedTargetRef = useRef<TreeMapExcerptTarget | null>(null)
  const navigateInFlightRef = useRef(false)

  useEffect(() => {
    return () => {
      if (deferTimerRef.current) {
        window.clearTimeout(deferTimerRef.current)
        deferTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const clearFocus = () => {
      if (skipNextClearRef.current) {
        skipNextClearRef.current = false
        return
      }
      if (!mapFocusRef.current) return
      mapFocusRef.current.classList.remove('map-focus')
      mapFocusRef.current = null
      focusedTargetRef.current = null
    }

    document.addEventListener('pointerdown', clearFocus)
    return () => {
      document.removeEventListener('pointerdown', clearFocus)
    }
  }, [])

  const findHighlightElement = (target: TreeMapExcerptTarget) => {
    const container = document.querySelector(
      `[data-doc-id="${target.docId}"] .document-content`,
    ) as HTMLElement | null
    if (!container) return null
    const highlights = Array.from(
      container.querySelectorAll(`span[data-code-id="${target.codeId}"]`),
    ) as HTMLElement[]
    if (!highlights.length) return null
    if (typeof target.highlightIndex === 'number') {
      const indexed = highlights[target.highlightIndex]
      if (indexed) return indexed
    }
    if (target.excerptText) {
      const trimmed = target.excerptText.trim()
      const match = highlights.find((highlight) => {
        const content = highlight.querySelector('.code-content') as HTMLElement | null
        const text = content?.textContent ?? highlight.textContent ?? ''
        return text.trim() === trimmed
      })
      if (match) return match
    }
    return highlights[0]
  }

  const setHighlightFocus = (element: HTMLElement) => {
    if (mapFocusRef.current && mapFocusRef.current !== element) {
      mapFocusRef.current.classList.remove('map-focus')
    }
    mapFocusRef.current = element
    element.classList.add('map-focus')
  }

  useEffect(() => {
    if (activeTab !== 'document') return
    if (!focusedTargetRef.current) return
    if (documentViewMode === 'single' && focusedTargetRef.current.docId !== activeDocumentId) {
      return
    }
    const highlight = findHighlightElement(focusedTargetRef.current)
    if (!highlight) return
    setHighlightFocus(highlight)
  }, [activeDocumentId, activeTab, documentViewMode, documents])

  useEffect(() => {
    if (activeTab !== 'document') return
    if (!focusedTargetRef.current) return

    const target = focusedTargetRef.current
    if (documentViewMode === 'single' && target.docId !== activeDocumentId) {
      return
    }

    const container = document.querySelector(
      `[data-doc-id="${target.docId}"] .document-content`,
    ) as HTMLElement | null
    if (!container) return

    const observer = new MutationObserver(() => {
      if (!focusedTargetRef.current) return
      const current = findHighlightElement(focusedTargetRef.current)
      if (!current) return
      if (!current.classList.contains('map-focus')) {
        setHighlightFocus(current)
      }
    })

    observer.observe(container, {
      subtree: true,
      attributes: true,
      childList: true,
      characterData: false,
    })

    return () => {
      observer.disconnect()
    }
  }, [activeDocumentId, activeTab, documentViewMode])

  const handleExcerptNavigate = (target: TreeMapExcerptTarget) => {
    const enableExcerptFocus = false
    if (navigateInFlightRef.current) return
    navigateInFlightRef.current = true
    setDeferEditorMount(true)
    window.setTimeout(() => {
      skipNextClearRef.current = true
      focusedTargetRef.current = target
      setActiveTab('document')
      if (documentViewMode === 'all') {
        onDocumentViewModeChange('single')
        onActiveDocumentChange(target.docId)
      } else if (activeDocumentId !== target.docId) {
        onActiveDocumentChange(target.docId)
      }
      if (deferTimerRef.current) {
        window.clearTimeout(deferTimerRef.current)
      }
      deferTimerRef.current = window.setTimeout(() => {
        setDeferEditorMount(false)
        navigateInFlightRef.current = false
      }, 200)
    }, 0)

    if (!enableExcerptFocus) return
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const highlight = findHighlightElement(target)
        if (!highlight) return
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightFocus(highlight)
      })
    })
  }

  const handleEditorMouseUp = (event: MouseEvent<HTMLDivElement>) => {
    onHighlightMouseUp()
    if (documentViewMode !== 'all') return
    const target = event.target as HTMLElement
    const container = target.closest('[data-doc-id]')
    const docId = container?.getAttribute('data-doc-id')
    if (docId && docId !== activeDocumentId) {
      onActiveDocumentChange(docId)
    }
  }

  const applyCodeStylesToHtml = useCallback((html: string) => {
    if (!html) return html
    const container = document.createElement('div')
    container.innerHTML = html
    container.querySelectorAll('[data-remove-code]').forEach((node) => node.remove())
    container.querySelectorAll('span[data-code-id]').forEach((node) => {
      if (!(node instanceof HTMLElement)) return
      const codeId = node.getAttribute('data-code-id')
      if (!codeId) return
      const code = codeById.get(codeId)
      if (!code) return
      const nextBg = code.colorHex ?? '#E2E8F0'
      const nextText = code.textHex ?? '#334155'
      const nextRing = code.ringHex ?? 'rgba(148,163,184,0.4)'
      node.style.backgroundColor = nextBg
      node.style.color = nextText
      node.style.display = 'inline-block'
      node.style.boxShadow = `inset 0 0 0 1px ${nextRing}`
      const label = node.querySelector('.code-label') as HTMLElement | null
      if (label) {
        label.style.color = nextText
      }
    })
    return container.innerHTML
  }, [codeById])

  const renderReadOnly = (html: string, text: string) => {
    if (html) {
      const styledHtml = applyCodeStylesToHtml(html)
      return (
        <div
          className="document-content relative min-h-[220px] whitespace-pre-wrap rounded-xl bg-white px-3 pb-3 pt-2 text-sm leading-7 text-slate-800 outline-none"
          style={{ fontFamily: documentFontFamily, lineHeight: documentLineHeight }}
          dangerouslySetInnerHTML={{ __html: styledHtml }}
        />
      )
    }
    return (
      <div
        className="document-content relative min-h-[220px] whitespace-pre-wrap rounded-xl bg-white px-3 pb-3 pt-2 text-sm leading-7 text-slate-800 outline-none"
        style={{ fontFamily: documentFontFamily, lineHeight: documentLineHeight }}
      >
        {text}
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Document Viewer</p>
          {isEditingProjectName ? (
            <input
              value={projectNameDraft}
              onChange={(event) => setProjectNameDraft(event.target.value)}
              onBlur={() => {
                const trimmed = projectNameDraft.trim()
                setIsEditingProjectName(false)
                if (!onProjectNameChange) return
                if (!trimmed) {
                  setProjectNameDraft(projectName)
                  return
                }
                if (trimmed !== projectName.trim()) {
                  onProjectNameChange(trimmed)
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setProjectNameDraft(projectName)
                  setIsEditingProjectName(false)
                  return
                }
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const trimmed = projectNameDraft.trim()
                  setIsEditingProjectName(false)
                  if (!onProjectNameChange) return
                  if (!trimmed) {
                    setProjectNameDraft(projectName)
                    return
                  }
                  if (trimmed !== projectName.trim()) {
                    onProjectNameChange(trimmed)
                  }
                }
              }}
              className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-1 text-xl font-semibold text-slate-900 shadow-sm"
              placeholder="Project name"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!canRenameProject) return
                setProjectNameDraft(projectName)
                setIsEditingProjectName(true)
              }}
              className={cn(
                'text-left text-xl font-semibold text-slate-900 transition',
                canRenameProject ? 'hover:text-slate-700' : 'cursor-default',
              )}
              aria-label="Rename project"
            >
              {displayProjectName}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('document')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition',
              activeTab === 'document'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            Document
          </button>
          <button
            id="theory-map-tab"
            type="button"
            onClick={() => setActiveTab('tree')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition',
              activeTab === 'tree'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            Theory Map
          </button>
          <button
            id="overview-tab"
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition',
              activeTab === 'overview'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            Overview
          </button>

          <button
            type="button"
            onClick={onAddDocument}
            className="ml-auto rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
          >
            Create document
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            id="document-view-mode"
            name="document-view-mode"
            value={
              hasDocuments
                ? documentViewMode === 'all'
                  ? '__all__'
                  : activeDocumentId
                : '__none__'
            }
            onChange={(event) => {
              if (!hasDocuments) return
              const nextValue = event.target.value
              if (nextValue === '__all__') {
                onDocumentViewModeChange('all')
                return
              }
              onDocumentViewModeChange('single')
              onActiveDocumentChange(nextValue)
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
            disabled={!hasDocuments}
          >
            {hasDocuments ? (
              <>
                <option value="__all__">All documents</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))}
              </>
            ) : (
              <option value="__none__">No documents</option>
            )}
          </select>
          <input
            id="document-title"
            name="document-title"
            value={hasDocuments ? documentTitle : ''}
            onChange={(event) => {
              if (!hasDocuments) return
              updateDocumentTitle(event.target.value)
            }}
            className={cn(
              'min-w-[160px] rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm',
              documentViewMode === 'all' && 'invisible pointer-events-none',
            )}
            placeholder="Document title"
            disabled={!hasDocuments}
          />
        </div>
      </div>

      {activeTab === 'document' ? (
        <>
          <div
            id="document-viewer"
            className={cn(
              'relative rounded-2xl bg-white p-8 shadow-sm',
              !showCodeLabels && 'hide-code-labels',
            )}
          >
          {!hasDocuments ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              <p>No documents yet. Create a new document to start writing.</p>
            </div>
          ) : documentViewMode === 'all' ? (
            <div className="space-y-10">
              {documents.map((doc, index) => (
                <div key={doc.id} className="relative space-y-3" data-doc-id={doc.id}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {doc.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onMoveDocument(doc.id, 'up')}
                        disabled={index === 0}
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold transition',
                          index === 0
                            ? 'cursor-not-allowed text-slate-300'
                            : 'text-slate-400 hover:border-slate-300 hover:text-slate-600',
                        )}
                        title="Move up"
                        aria-label="Move document up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveDocument(doc.id, 'down')}
                        disabled={index === documents.length - 1}
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold transition',
                          index === documents.length - 1
                            ? 'cursor-not-allowed text-slate-300'
                            : 'text-slate-400 hover:border-slate-300 hover:text-slate-600',
                        )}
                        title="Move down"
                        aria-label="Move document down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveDocument(doc.id, doc.title)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-400 transition hover:border-rose-200 hover:text-rose-500"
                        title="Delete document"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {debugDisableEditors ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      Editor disabled (debug).
                    </div>
                  ) : deferEditorMount ? (
                    renderReadOnly(doc.html ?? '', doc.text ?? '')
                  ) : (
                    <DocumentEditor
                      documentId={doc.id}
                      initialHtml={toInitialHtml(doc)}
                      onUpdate={(html, text) => {
                        onDocumentInput(doc.id, { html, text })
                      }}
                      onEditorReady={onEditorReady}
                      onMouseDown={onHighlightMouseDown}
                      onMouseUp={handleEditorMouseUp}
                      onClick={onHighlightClick}
                      editorRef={onEditorRef}
                      ydoc={ydoc}
                      fontFamily={documentFontFamily}
                      fontFamilyValue={documentFontFamilyDisplay}
                      lineHeight={documentLineHeight}
                      collaborationEnabled={collaborationEnabled}
                      canSeedInitialContent={canSeedInitialContent}
                      seedReady={seedReady}
                      hasRemoteUpdates={hasRemoteUpdates}
                      hasReceivedSync={hasReceivedSync}
                      setFontFamily={(value) => {
                        onDocumentFontFamilyChange(value)
                        onDocumentFontFamilyDisplayChange(value)
                      }}
                      setLineHeight={onDocumentLineHeightChange}
                    />
                  )}
                  {index < documents.length - 1 && (
                    <div className="border-b border-dashed border-slate-200" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="relative" data-doc-id={activeDocumentId}>
              <div className="absolute right-0 top-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onMoveDocument(activeDocumentId, 'up')}
                  disabled={documents.findIndex((doc) => doc.id === activeDocumentId) <= 0}
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold transition',
                    documents.findIndex((doc) => doc.id === activeDocumentId) <= 0
                      ? 'cursor-not-allowed text-slate-300'
                      : 'text-slate-400 hover:border-slate-300 hover:text-slate-600',
                  )}
                  title="Move up"
                  aria-label="Move document up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMoveDocument(activeDocumentId, 'down')}
                  disabled={
                    (() => {
                      const idx = documents.findIndex((doc) => doc.id === activeDocumentId)
                      return idx === -1 || idx >= documents.length - 1
                    })()
                  }
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold transition',
                    (() => {
                      const idx = documents.findIndex((doc) => doc.id === activeDocumentId)
                      return idx === -1 || idx >= documents.length - 1
                    })()
                      ? 'cursor-not-allowed text-slate-300'
                      : 'text-slate-400 hover:border-slate-300 hover:text-slate-600',
                  )}
                  title="Move down"
                  aria-label="Move document down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onRemoveDocument(activeDocumentId, documentTitle || 'Untitled document')
                  }
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-400 transition hover:border-rose-200 hover:text-rose-500"
                  title="Delete document"
                  aria-label="Delete document"
                >
                  ×
                </button>
              </div>
              {debugDisableEditors ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Editor disabled (debug).
                </div>
              ) : deferEditorMount ? (
                renderReadOnly(
                  documents.find((doc) => doc.id === activeDocumentId)?.html ?? '',
                  documents.find((doc) => doc.id === activeDocumentId)?.text ?? '',
                )
              ) : (
                <DocumentEditor
                  key={activeDocumentId}
                  documentId={activeDocumentId}
                  initialHtml={toInitialHtml(documents.find((doc) => doc.id === activeDocumentId))}
                  onUpdate={(html, text) => {
                    onDocumentInput(activeDocumentId, { html, text })
                  }}
                  onEditorReady={onEditorReady}
                  onMouseDown={onHighlightMouseDown}
                  onMouseUp={handleEditorMouseUp}
                  onClick={onHighlightClick}
                  editorRef={onEditorRef}
                  ydoc={ydoc}
                  fontFamily={documentFontFamily}
                  fontFamilyValue={documentFontFamilyDisplay}
                  lineHeight={documentLineHeight}
                  collaborationEnabled={collaborationEnabled}
                  canSeedInitialContent={canSeedInitialContent}
                  seedReady={seedReady}
                  hasRemoteUpdates={hasRemoteUpdates}
                  hasReceivedSync={hasReceivedSync}
                  setFontFamily={(value) => {
                    onDocumentFontFamilyChange(value)
                    onDocumentFontFamilyDisplayChange(value)
                  }}
                  setLineHeight={onDocumentLineHeightChange}
                />
              )}
            </div>
          )}
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onAddDocument}
              className="mt-6 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
            >
              Create document
            </button>
          </div>
        </>
      ) : activeTab === 'tree' ? (
        <TreeMapView
          documents={documents}
          codes={codes}
          categories={categories}
          memos={memos}
          coreCategoryId={coreCategoryId}
          showMemos={showMemos}
          theoryHtml={theoryHtml}
          onExcerptNavigate={handleExcerptNavigate}
        />
      ) : (
        <StatsOverviewPanel
          documents={documents}
          codes={codes}
          categories={categories}
          memos={memos}
        />
      )}
    </section>
  )
}
