import { type MouseEvent } from 'react'
import { type DocumentItem, type DocumentViewMode } from './DashboardLayout.types'
import { DocumentEditor } from './DocumentEditor'
import { cn } from '../lib/cn'
import './DocumentViewerPanel.css'

type DocumentViewerPanelProps = {
  documents: DocumentItem[]
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
  return (
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
                      if (node.innerHTML !== html) {
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
    </section>
  )
}
