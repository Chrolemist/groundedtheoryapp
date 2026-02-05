import { type MouseEvent, type MutableRefObject } from 'react'
import { type Code } from '../types'
import { type DocumentItem } from '../components/DashboardLayout.types'

type UseHighlightingArgs = {
  codeById: Map<string, Code>
  selectionRangeRef: MutableRefObject<Range | null>
  selectionDocumentIdRef: MutableRefObject<string | null>
  updateDocument: (documentId: string, patch: Partial<DocumentItem>) => void
  pushHistory: () => void
}

// Selection tracking and highlight rendering for document codes.
export function useHighlighting({
  codeById,
  selectionRangeRef,
  selectionDocumentIdRef,
  updateDocument,
  pushHistory,
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

  const getSelectionDocumentId = (range: Range) => {
    const node = range.commonAncestorContainer
    const element = node instanceof HTMLElement ? node : node.parentElement
    const container = element?.closest('[data-doc-id]')
    return container?.getAttribute('data-doc-id') ?? null
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
    const element =
      target instanceof Element ? target : target instanceof Node ? target.parentElement : null
    return element?.closest('[data-remove-code]') as HTMLElement | null
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

  return {
    handleHighlightMouseDown,
    handleSelection,
    getClosestRemoveButton,
    applyCodeToSelection,
    removeHighlightSpan,
    getSelectionDocumentId,
  }
}
