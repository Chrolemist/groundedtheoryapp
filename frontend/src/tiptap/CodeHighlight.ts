import { Node, mergeAttributes, type NodeViewRendererProps } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

type CodeHighlightAttrs = {
  codeId?: string | null
  label?: string | null
  colorHex?: string | null
  textHex?: string | null
  ringHex?: string | null
}

const createRemoveButton = (
  node: ProseMirrorNode,
  getPos: () => number,
  view: NodeViewRendererProps['view'],
) => {
  const button = document.createElement('span')
  button.className = 'code-remove'
  button.setAttribute('data-remove-code', 'true')
  button.setAttribute('title', 'Remove highlight')
  button.setAttribute('contenteditable', 'false')
  button.setAttribute('data-non-editable', 'true')
  button.textContent = '×'
  button.style.fontSize = '10px'
  button.style.opacity = '0.6'
  button.style.fontWeight = '700'
  button.style.position = 'absolute'
  button.style.right = '4px'
  button.style.top = '2px'
  button.style.transform = 'none'
  button.style.borderRadius = '999px'
  button.style.padding = '0 4px'
  button.style.lineHeight = '1'
  button.style.zIndex = '2'
  button.style.pointerEvents = 'auto'
  button.addEventListener('mousedown', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    // Ensure the ProseMirror editor keeps focus so downstream "dirty" heuristics
    // (used by autosave) treat this as a local document edit.
    view.focus()
    const pos = getPos()
    const text = node.textContent || ''
    const tr = view.state.tr
    tr.replaceWith(pos, pos + node.nodeSize, view.state.schema.text(text))
    view.dispatch(tr)
  })
  return button
}

export const CodeHighlight = Node.create<CodeHighlightAttrs>({
  name: 'codeHighlight',
  inline: true,
  group: 'inline',
  content: 'inline*',
  selectable: false,

  addAttributes() {
    return {
      codeId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-code-id'),
        renderHTML: (attributes: CodeHighlightAttrs) => {
          if (!attributes.codeId) return {}
          return { 'data-code-id': attributes.codeId }
        },
      },
      label: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-code-label'),
        renderHTML: (attributes: CodeHighlightAttrs) => {
          if (!attributes.label) return {}
          return { 'data-code-label': attributes.label }
        },
      },
      colorHex: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-code-bg'),
        renderHTML: (attributes: CodeHighlightAttrs) => {
          if (!attributes.colorHex) return {}
          return { 'data-code-bg': attributes.colorHex }
        },
      },
      textHex: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-code-text'),
        renderHTML: (attributes: CodeHighlightAttrs) => {
          if (!attributes.textHex) return {}
          return { 'data-code-text': attributes.textHex }
        },
      },
      ringHex: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-code-ring'),
        renderHTML: (attributes: CodeHighlightAttrs) => {
          if (!attributes.ringHex) return {}
          return { 'data-code-ring': attributes.ringHex }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-code-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ({ node, getPos, view }) => {
      const wrapper = document.createElement('span')
      wrapper.setAttribute('data-code-id', String(node.attrs.codeId ?? ''))
      wrapper.setAttribute('data-code-label', String(node.attrs.label ?? ''))
      if (node.attrs.colorHex) wrapper.setAttribute('data-code-bg', node.attrs.colorHex)
      if (node.attrs.textHex) wrapper.setAttribute('data-code-text', node.attrs.textHex)
      if (node.attrs.ringHex) wrapper.setAttribute('data-code-ring', node.attrs.ringHex)
      wrapper.style.backgroundColor = node.attrs.colorHex ?? '#E2E8F0'
      wrapper.style.color = node.attrs.textHex ?? '#334155'
      wrapper.style.borderRadius = '6px'
      wrapper.style.padding = '0 18px 0 4px'
      wrapper.style.boxShadow = `inset 0 0 0 1px ${
        node.attrs.ringHex ?? 'rgba(148,163,184,0.4)'
      }`
      wrapper.style.position = 'relative'
      wrapper.style.display = 'inline-block'
      wrapper.style.paddingTop = '16px'

      const label = document.createElement('span')
      label.className = 'code-label'
      label.textContent = node.attrs.label ?? ''
      label.setAttribute('contenteditable', 'false')
      label.setAttribute('data-non-editable', 'true')
      label.style.position = 'absolute'
      label.style.top = '2px'
      label.style.left = '4px'
      label.style.fontSize = '8px'
      label.style.fontWeight = '600'
      label.style.letterSpacing = '0.08em'
      label.style.textTransform = 'uppercase'
      label.style.color = node.attrs.textHex ?? '#475569'
      label.style.backgroundColor = 'transparent'
      label.style.padding = '0'
      label.style.borderRadius = '999px'
      label.style.boxShadow = 'none'
      label.style.display = 'inline-flex'
      label.style.alignItems = 'center'
      label.style.gap = '4px'

      const content = document.createElement('span')
      content.className = 'code-content'

      const removeButton = createRemoveButton(node, getPos, view)
      removeButton.style.color = node.attrs.textHex ?? '#0F172A'
      removeButton.style.backgroundColor = 'rgba(255,255,255,0.7)'

      wrapper.appendChild(label)
      wrapper.appendChild(content)
      wrapper.appendChild(removeButton)

      return {
        dom: wrapper,
        contentDOM: content,
      }
    }
  },
})
