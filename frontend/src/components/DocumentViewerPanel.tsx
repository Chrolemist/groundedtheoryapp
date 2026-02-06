import { useEffect, useRef, useState, type MouseEvent } from 'react'
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
  onDocumentCommand: (command: string, value?: string) => void
  onHighlightMouseDown: (event: MouseEvent<HTMLElement>) => void
  onHighlightMouseUp: () => void
  onHighlightClick: (event: MouseEvent<HTMLElement>) => void
  onEditorRef: (node: HTMLDivElement | null) => void
}

// Document editing surface with single/all view modes.
export function DocumentViewerPanel({
  documents,
  codes,
  categories,
  memos,
  coreCategoryId,
  showMemos,
  theoryHtml,
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
  onDocumentCommand,
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
                          onDocumentFontFamilyChange(event.target.value)
                          onDocumentFontFamilyDisplayChange(event.target.value)
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
                        <option value="'Source Sans Pro', Arial, sans-serif">Source Sans Pro</option>
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
                        onChange={(event) => onDocumentLineHeightChange(event.target.value)}
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
                        const normalizedCurrent = stripMapFocus(node.innerHTML)
                        const normalizedNext = stripMapFocus(html)
                        if (normalizedCurrent !== normalizedNext) {
                          node.innerHTML = html
                        }
                      }}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(event) => {
                        const html = (event.target as HTMLDivElement).innerHTML
                        onDocumentInput(doc.id, {
                          html,
                          text: (event.target as HTMLDivElement).innerText,
                        })
                      }}
                      onMouseDown={onHighlightMouseDown}
                      onMouseUp={onHighlightMouseUp}
                      onClick={onHighlightClick}
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
                onCommand={onDocumentCommand}
                onInput={(event) => {
                  const html = (event.target as HTMLDivElement).innerHTML
                  onDocumentInput(activeDocumentId, {
                    html,
                    text: (event.target as HTMLDivElement).innerText,
                  })
                }}
                onPaste={() => {
                  return
                }}
                onMouseDown={onHighlightMouseDown}
                onMouseUp={onHighlightMouseUp}
                onClick={onHighlightClick}
                editorRef={onEditorRef}
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
