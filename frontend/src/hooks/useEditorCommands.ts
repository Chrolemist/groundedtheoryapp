import { type MutableRefObject } from 'react'

type UseEditorCommandsArgs = {
  documentEditorRef: MutableRefObject<HTMLDivElement | null>
  theoryEditorRef: MutableRefObject<HTMLDivElement | null>
}

// Shared rich-text editor commands for document + theory editors.
export function useEditorCommands({
  documentEditorRef,
  theoryEditorRef,
}: UseEditorCommandsArgs) {
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

  return {
    applyEditorCommand,
    applyDocumentCommand,
    executeEditorCommand,
    pasteFromClipboard,
  }
}
