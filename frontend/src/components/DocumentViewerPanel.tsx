import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { Doc } from 'yjs'
import type { Editor } from '@tiptap/react'
import { type Category, type Code, type Memo } from '../types'
import { type DocumentItem, type DocumentViewMode } from './DashboardLayout.types'
import { DocumentEditor } from './DocumentEditor'
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
  ydoc: Doc
  activeDocumentId: string
  documentViewMode: DocumentViewMode
  onDocumentViewModeChange: (value: DocumentViewMode) => void
  onActiveDocumentChange: (documentId: string) => void
  documentTitle: string
  onDocumentTitleChange: (title: string) => void
  documentFontFamily: string
  documentFontFamilyDisplay: string
  onDocumentFontFamilyChange: (value: string) => void
  onDocumentFontFamilyDisplayChange: (value: string) => void
  documentLineHeight: string
  onDocumentLineHeightChange: (value: string) => void
  showCodeLabels: boolean
  onDocumentInput: (documentId: string, patch: { html: string; text: string }) => void
  onEditorReady: (documentId: string, editor: Editor | null) => void
  onHighlightMouseDown: (event: MouseEvent<HTMLElement>) => void
  onHighlightMouseUp: () => void
  onHighlightClick: (event: MouseEvent<HTMLElement>) => void
  onEditorRef: (node: HTMLDivElement | null) => void
}

export function DocumentViewerPanel({
  documents,
  codes,
  categories,
  memos,
  coreCategoryId,
  showMemos,
  theoryHtml,
  ydoc,
  activeDocumentId,
  documentViewMode,
  onDocumentViewModeChange,
  onActiveDocumentChange,
  documentTitle,
  onDocumentTitleChange,
  documentFontFamily,
  documentFontFamilyDisplay,
  onDocumentFontFamilyChange,
  onDocumentFontFamilyDisplayChange,
  documentLineHeight,
  onDocumentLineHeightChange,
  showCodeLabels,
  onDocumentInput,
  onEditorReady,
  onHighlightMouseDown,
  onHighlightMouseUp,
  onHighlightClick,
  onEditorRef,
  }: DocumentViewerPanelProps) {
  const [activeTab, setActiveTab] = useState<'document' | 'tree' | 'overview'>(
    'document',
  )
  const mapFocusRef = useRef<HTMLElement | null>(null)
  const skipNextClearRef = useRef(false)
  const focusedTargetRef = useRef<TreeMapExcerptTarget | null>(null)

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
    skipNextClearRef.current = true
    focusedTargetRef.current = target
    setActiveTab('document')
    if (documentViewMode === 'single' && activeDocumentId !== target.docId) {
      onActiveDocumentChange(target.docId)
    }

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

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Document Viewer</p>
          <h2 className="text-xl font-semibold text-slate-900">Interview Transcript</h2>
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
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            id="document-view-mode"
            name="document-view-mode"
            value={documentViewMode === 'all' ? '__all__' : activeDocumentId}
            onChange={(event) => {
              const nextValue = event.target.value
              if (nextValue === '__all__') {
                onDocumentViewModeChange('all')
                return
              }
              onDocumentViewModeChange('single')
              onActiveDocumentChange(nextValue)
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
            value={documentTitle}
            onChange={(event) => onDocumentTitleChange(event.target.value)}
            className="min-w-[160px] rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
            placeholder="Document title"
          />
        </div>
      </div>

      {activeTab === 'document' ? (
        <div
          id="document-viewer"
          className={cn(
            'relative rounded-2xl bg-white p-8 shadow-sm',
            !showCodeLabels && 'hide-code-labels',
          )}
        >
          {documentViewMode === 'all' ? (
            <div className="space-y-10">
              {documents.map((doc, index) => (
                <div key={doc.id} className="relative space-y-3" data-doc-id={doc.id}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {doc.title}
                    </p>
                    <span className="text-xs text-slate-400">Document {index + 1}</span>
                  </div>
                  <DocumentEditor
                    documentId={doc.id}
                    initialHtml={doc.html ?? ''}
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
                    setFontFamily={(value) => {
                      onDocumentFontFamilyChange(value)
                      onDocumentFontFamilyDisplayChange(value)
                    }}
                    setLineHeight={onDocumentLineHeightChange}
                  />
                  {index < documents.length - 1 && (
                    <div className="border-b border-dashed border-slate-200" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="relative space-y-4" data-doc-id={activeDocumentId}>
              <DocumentEditor
                documentId={activeDocumentId}
                initialHtml={
                  documents.find((doc) => doc.id === activeDocumentId)?.html ?? ''
                }
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
                setFontFamily={(value) => {
                  onDocumentFontFamilyChange(value)
                  onDocumentFontFamilyDisplayChange(value)
                }}
                setLineHeight={onDocumentLineHeightChange}
              />
            </div>
          )}
        </div>
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
