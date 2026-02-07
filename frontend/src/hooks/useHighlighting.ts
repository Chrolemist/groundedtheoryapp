import { useCallback, useEffect, type MouseEvent, type MutableRefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { type Code } from '../types'
import { type DocumentItem } from '../components/DashboardLayout.types'

type UseHighlightingArgs = {
  codeById: Map<string, Code>
  selectionRangeRef: MutableRefObject<Range | null>
  selectionDocumentIdRef: MutableRefObject<string | null>
  updateDocument: (documentId: string, patch: Partial<DocumentItem>) => void
  pushHistory: () => void
  documentEditorInstanceRef?: MutableRefObject<Editor | null>
  documentEditorInstancesRef?: MutableRefObject<Map<string, Editor>>
  activeDocumentId?: string
  onLocalChange?: () => void
}

// Selection tracking and highlight rendering for document codes.
export function useHighlighting({
  codeById,
  selectionRangeRef,
  selectionDocumentIdRef,
  updateDocument,
  pushHistory,
  documentEditorInstanceRef,
  documentEditorInstancesRef,
  activeDocumentId,
  onLocalChange,
}: UseHighlightingArgs) {
  const placeCaretInContent = (content: HTMLElement, event?: MouseEvent<HTMLElement>) => {
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

  const handleHighlightMouseDown = (event: MouseEvent<HTMLElement>) => {
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

  const getSelectionDocumentId = useCallback((range: Range) => {
    const node = range.commonAncestorContainer
    const element = node instanceof HTMLElement ? node : node.parentElement
    const container = element?.closest('[data-doc-id]')
    return container?.getAttribute('data-doc-id') ?? null
  }, [])

  useEffect(() => {
    const handleSelectionChange = () => {
      const selectionRef = window.getSelection()
      if (!selectionRef || selectionRef.isCollapsed) return

      const range = selectionRef.getRangeAt(0)
      const text = selectionRef.toString().trim()
      if (!text) return

      const docId = getSelectionDocumentId(range)
      if (!docId) return

      selectionRangeRef.current = range.cloneRange()
      selectionDocumentIdRef.current = docId
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [selectionDocumentIdRef, selectionRangeRef])

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
    const docId = getSelectionDocumentId(range)
    if (!docId) return

    selectionRangeRef.current = range.cloneRange()
    selectionDocumentIdRef.current = docId
  }

  const getClosestRemoveButton = (target: EventTarget | null) => {
    const element =
      target instanceof Element ? target : target instanceof Node ? target.parentElement : null
    return element?.closest('[data-remove-code]') as HTMLElement | null
  }

  const applyCodeToSelection = (codeId: string) => {
    let tiptapEditor: Editor | null = null
    let tiptapFrom: number | null = null
    let tiptapTo: number | null = null

    const storedRange = selectionRangeRef.current
    const selectionDocumentId = selectionDocumentIdRef.current
    if (selectionDocumentId) {
      const editor =
        documentEditorInstancesRef?.current.get(selectionDocumentId) ||
        documentEditorInstanceRef?.current
      if (editor) {
        const { from, to } = editor.state.selection
        if (from !== to) {
          tiptapEditor = editor
          tiptapFrom = from
          tiptapTo = to
        } else if (storedRange) {
          try {
            if (!editor.view.dom.contains(storedRange.commonAncestorContainer)) {
              throw new Error('selection-outside-editor')
            }
            const start = editor.view.posAtDOM(
              storedRange.startContainer,
              storedRange.startOffset,
            )
            const end = editor.view.posAtDOM(
              storedRange.endContainer,
              storedRange.endOffset,
            )
            if (start >= 0 && end >= 0 && start !== end) {
              tiptapEditor = editor
              tiptapFrom = Math.min(start, end)
              tiptapTo = Math.max(start, end)
            }
          } catch {
            // Ignore invalid range mapping.
          }
        }
      }
    }

    if (!tiptapEditor) {
      if (documentEditorInstancesRef) {
        for (const [, editor] of documentEditorInstancesRef.current.entries()) {
          const { from, to } = editor.state.selection
          if (from !== to) {
            tiptapEditor = editor
            tiptapFrom = from
            tiptapTo = to
            break
          }
        }
      }
      if (!tiptapEditor && documentEditorInstanceRef?.current) {
        const { from, to } = documentEditorInstanceRef.current.state.selection
        if (from !== to) {
          tiptapEditor = documentEditorInstanceRef.current
          tiptapFrom = from
          tiptapTo = to
        }
      }
    }

    if (tiptapEditor) {
      const codeToApply = codeById.get(codeId)
      if (!codeToApply) return
      const { from, to } = tiptapEditor.state.selection
      const resolvedFrom = tiptapFrom ?? from
      const resolvedTo = tiptapTo ?? to
      if (resolvedFrom === resolvedTo) return
      const attrs = {
        codeId: codeToApply.id,
        label: codeToApply.label,
        colorHex: codeToApply.colorHex ?? '#E2E8F0',
        textHex: codeToApply.textHex ?? '#334155',
        ringHex: codeToApply.ringHex ?? 'rgba(148,163,184,0.4)',
      }

      tiptapEditor
        .chain()
        .focus()
        .command(({ tr, state }) => {
          const nodeType = state.schema.nodes.codeHighlight
          if (!nodeType) return false

          const text = state.doc.textBetween(resolvedFrom, resolvedTo, '\n', '\n')
          if (!text) return false
          const node = nodeType.create(attrs, state.schema.text(text))
          tr.replaceRangeWith(resolvedFrom, resolvedTo, node)
          tr.setSelection(TextSelection.create(tr.doc, resolvedFrom + node.nodeSize))
          return tr.docChanged
        })
        .run()
      onLocalChange?.()
      selectionRangeRef.current = null
      selectionDocumentIdRef.current = null
      return
    }

    if (documentEditorInstancesRef?.current.size || documentEditorInstanceRef?.current) {
      return
    }

    const selectionRef = window.getSelection()
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

    const blockSelectors = 'div,p,li,h1,h2,h3,h4,h5,h6'
    const normalizeBlocks = (content: HTMLElement) => {
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
    }

    try {
      const fragment = range.extractContents()
      const content = document.createElement('span')
      content.className = 'code-content'
      if (fragment.childNodes.length) {
        content.appendChild(fragment)
      } else {
        content.textContent = range.toString()
      }
      normalizeBlocks(content)
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
      normalizeBlocks(content)
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
    onLocalChange?.()
  }

  const removeHighlightSpan = (element: HTMLElement) => {
    if (documentEditorInstancesRef?.current.size || documentEditorInstanceRef?.current) {
      return false
    }
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
    onLocalChange?.()
    return true
  }

  const removeHighlightsByCodeId = (codeId: string) => {
    const removeFromEditor = (editor: Editor) => {
      const { state, view } = editor
      const ranges: Array<{ from: number; to: number; text: string }> = []
      state.doc.descendants((node, pos) => {
        if (node.type.name !== 'codeHighlight') return
        if (node.attrs.codeId !== codeId) return
        ranges.push({ from: pos, to: pos + node.nodeSize, text: node.textContent || '' })
      })

      if (!ranges.length) return false
      let tr = state.tr
      for (let index = ranges.length - 1; index >= 0; index -= 1) {
        const { from, to, text } = ranges[index]
        if (text) {
          tr = tr.replaceWith(from, to, state.schema.text(text))
        } else {
          tr = tr.delete(from, to)
        }
      }
      if (tr.docChanged) view.dispatch(tr)
      return tr.docChanged
    }

    let changed = false
    if (documentEditorInstancesRef?.current.size) {
      documentEditorInstancesRef.current.forEach((editor, docId) => {
        if (removeFromEditor(editor)) {
          changed = true
          updateDocument(docId, { html: editor.getHTML(), text: editor.getText() })
        }
      })
    }
    if (documentEditorInstanceRef?.current) {
      if (removeFromEditor(documentEditorInstanceRef.current)) {
        changed = true
        if (activeDocumentId) {
          updateDocument(activeDocumentId, {
            html: documentEditorInstanceRef.current.getHTML(),
            text: documentEditorInstanceRef.current.getText(),
          })
        }
      }
    }
    if (changed) {
      onLocalChange?.()
    }
    return changed
  }

  return {
    handleHighlightMouseDown,
    handleSelection,
    getClosestRemoveButton,
    applyCodeToSelection,
    removeHighlightSpan,
    removeHighlightsByCodeId,
    getSelectionDocumentId,
  }
}
