import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Underline from '@tiptap/extension-underline'
import { CodeHighlight } from '../tiptap/CodeHighlight'
import type * as Y from 'yjs'

type DocumentEditorProps = {
  documentId: string
  initialHtml: string
  onUpdate: (html: string, text: string) => void
  onEditorReady: (documentId: string, editor: ReturnType<typeof useEditor> | null) => void
  onMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void
  onMouseUp?: (event: React.MouseEvent<HTMLDivElement>) => void
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
  editorRef: (node: HTMLDivElement | null) => void
  ydoc: Y.Doc
  fontFamily: string
  fontFamilyValue: string
  lineHeight: string
  setFontFamily: (value: string) => void
  setLineHeight: (value: string) => void
  canSeedInitialContent: boolean
  seedReady: boolean
  hasRemoteUpdates: boolean
  hasReceivedSync: boolean
}

export function DocumentEditor({
  documentId,
  initialHtml,
  onUpdate,
  onEditorReady,
  onMouseDown,
  onMouseUp,
  onClick,
  editorRef,
  ydoc,
  fontFamily,
  fontFamilyValue,
  lineHeight,
  setFontFamily,
  setLineHeight,
  canSeedInitialContent,
  seedReady,
  hasRemoteUpdates,
  hasReceivedSync,
}: DocumentEditorProps) {
  const didSeedRef = useRef(false)
  const extensions = [
    StarterKit.configure({ history: false }),
    Underline,
    CodeHighlight,
    Collaboration.configure({
      document: ydoc,
      field: documentId,
    }),
  ]
  const editor = useEditor({
    extensions,
    content: '',
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML(), editor.getText())
    },
  })

  useEffect(() => {
    onEditorReady(documentId, editor)
    return () => {
      onEditorReady(documentId, null)
    }
  }, [documentId, editor, onEditorReady])

  useEffect(() => {
    if (!editor) return
    const fragment = ydoc.getXmlFragment(documentId)
    if (!seedReady) return
    if (!canSeedInitialContent) return
    if (!hasReceivedSync) return
    if (hasRemoteUpdates) return
    if (didSeedRef.current) return
    if (fragment.toString().length === 0 && initialHtml) {
      editor.commands.setContent(initialHtml, false)
      didSeedRef.current = true
    }
    if (fragment.toString().length > 0) {
      didSeedRef.current = true
    }
  }, [
    editor,
    documentId,
    initialHtml,
    ydoc,
    canSeedInitialContent,
    seedReady,
    hasRemoteUpdates,
    hasReceivedSync,
  ])

  const runCommand = (command: string, value?: string) => {
    if (!editor) return
    const chain = editor.chain().focus()
    switch (command) {
      case 'bold':
        chain.toggleBold().run()
        break
      case 'italic':
        chain.toggleItalic().run()
        break
      case 'underline':
        chain.toggleUnderline?.().run()
        break
      case 'fontSize':
        break
      case 'foreColor':
        break
      default:
        break
    }
    if (value) {
      void value
    }
  }

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (editor && event.target === event.currentTarget) {
      editor.commands.focus('end')
    }
    onMouseDown?.(event)
  }

  const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    onMouseUp?.(event)
  }

  return (
    <div className="rounded-xl bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <button
          type="button"
          onClick={() => runCommand('bold')}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => runCommand('italic')}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Italic
        </button>
        <select
          id="doc-font-size"
          name="doc-font-size"
          onChange={(event) => runCommand('fontSize', event.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
          defaultValue="3"
        >
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Large</option>
          <option value="5">XL</option>
        </select>
        <select
          id="doc-font-family"
          name="doc-font-family"
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
          id="doc-line-height"
          name="doc-line-height"
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
      <EditorContent
        editor={editor}
        className="document-content relative min-h-[220px] whitespace-pre-wrap px-3 pb-3 pt-2 text-sm leading-7 text-slate-800 outline-none"
        style={{ fontFamily, lineHeight }}
        data-editor="tiptap"
        ref={editorRef}
        spellCheck={false}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={onClick}
      />
    </div>
  )
}
