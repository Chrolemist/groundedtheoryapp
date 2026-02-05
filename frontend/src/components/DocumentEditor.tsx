import { type FormEvent } from 'react'

type DocumentEditorProps = {
  onCommand: (command: string, value?: string) => void
  onInput: (event: FormEvent<HTMLDivElement>) => void
  onPaste: (event: React.ClipboardEvent<HTMLDivElement>) => void
  editorRef: (node: HTMLDivElement | null) => void
  fontFamily: string
  fontFamilyValue: string
  lineHeight: string
  setFontFamily: (value: string) => void
  setLineHeight: (value: string) => void
}

export function DocumentEditor({
  onCommand,
  onInput,
  onPaste,
  editorRef,
  fontFamily,
  fontFamilyValue,
  lineHeight,
  setFontFamily,
  setLineHeight,
}: DocumentEditorProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <button
          type="button"
          onClick={() => onCommand('bold')}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => onCommand('italic')}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Italic
        </button>
        <select
          onChange={(event) => onCommand('fontSize', event.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
          defaultValue="3"
        >
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Large</option>
          <option value="5">XL</option>
        </select>
        <select
          value={fontFamilyValue}
          onChange={(event) => setFontFamily(event.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
        >
          <option value="__mixed__" disabled>
            Mixed
          </option>
          <option value="Inter, ui-sans-serif, system-ui">Inter</option>
          <option value="Arial, Helvetica, sans-serif">Arial</option>
          <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica Neue</option>
          <option value="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif">Segoe UI</option>
          <option value="Roboto, 'Helvetica Neue', Arial, sans-serif">Roboto</option>
          <option value="'Open Sans', Arial, sans-serif">Open Sans</option>
          <option value="Lato, Arial, sans-serif">Lato</option>
          <option value="'Montserrat', Arial, sans-serif">Montserrat</option>
          <option value="'Noto Sans', Arial, sans-serif">Noto Sans</option>
          <option value="'Source Sans Pro', Arial, sans-serif">Source Sans Pro</option>
          <option value="'Times New Roman', Times, serif">Times New Roman</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Garamond, 'Times New Roman', serif">Garamond</option>
          <option value="'Palatino Linotype', 'Book Antiqua', Palatino, serif">Palatino</option>
          <option value="'Book Antiqua', 'Palatino Linotype', serif">Book Antiqua</option>
          <option value="'Courier New', Courier, monospace">Courier New</option>
          <option value="'Lucida Console', Monaco, monospace">Lucida Console</option>
          <option value="'Consolas', 'Courier New', monospace">Consolas</option>
          <option value="'Tahoma', Geneva, sans-serif">Tahoma</option>
          <option value="'Verdana', Geneva, sans-serif">Verdana</option>
        </select>
        <select
          value={lineHeight}
          onChange={(event) => setLineHeight(event.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
        >
          <option value="1.4">Tight</option>
          <option value="1.6">Normal</option>
          <option value="1.75">Relaxed</option>
          <option value="2">Loose</option>
        </select>
      </div>
      <div
        ref={editorRef}
        className="document-content min-h-[220px] whitespace-pre-wrap px-3 py-3 text-sm leading-7 text-slate-800 outline-none"
        style={{ fontFamily, lineHeight }}
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        onPaste={onPaste}
      />
    </div>
  )
}
