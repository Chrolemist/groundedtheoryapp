import { type Category, type Code, type Memo } from '../types'
import { type DocumentItem, type DocumentViewMode } from '../components/DashboardLayout.types'

type UseProjectIOArgs = {
  documents: DocumentItem[]
  codes: Code[]
  categories: Category[]
  memos: Memo[]
  coreCategoryId: string
  theoryHtml: string
  activeDocumentId: string
  documentViewMode: DocumentViewMode
  documentFontFamily: string
  documentLineHeight: string
  showCodeLabels: boolean
  setDocuments: (documents: DocumentItem[]) => void
  setCodes: (codes: Code[]) => void
  setCategories: (categories: Category[]) => void
  setMemos: (memos: Memo[]) => void
  setCoreCategoryId: (id: string) => void
  setTheoryHtml: (html: string) => void
  setActiveDocumentId: (id: string) => void
  setDocumentViewMode: (mode: DocumentViewMode) => void
  setDocumentFontFamily: (value: string) => void
  setDocumentFontFamilyDisplay: (value: string) => void
  setDocumentLineHeight: (value: string) => void
  setShowCodeLabels: (value: boolean) => void
  getReadableTextColor: (hex: string) => string
}

// Project export/import helpers for JSON and report exports.
export function useProjectIO({
  documents,
  codes,
  categories,
  memos,
  coreCategoryId,
  theoryHtml,
  activeDocumentId,
  documentViewMode,
  documentFontFamily,
  documentLineHeight,
  showCodeLabels,
  setDocuments,
  setCodes,
  setCategories,
  setMemos,
  setCoreCategoryId,
  setTheoryHtml,
  setActiveDocumentId,
  setDocumentViewMode,
  setDocumentFontFamily,
  setDocumentFontFamilyDisplay,
  setDocumentLineHeight,
  setShowCodeLabels,
  getReadableTextColor,
}: UseProjectIOArgs) {
  const buildProjectState = () => {
    const highlights: Array<{
      id: string
      document_id: string
      start_index: number
      end_index: number
      code_id: string
    }> = []

    const parsedDocuments = documents.map((doc) => {
      if (!doc.html) {
        return { ...doc, content: doc.text }
      }

      const parser = new DOMParser()
      const wrapper = parser.parseFromString(`<div>${doc.html}</div>`, 'text/html')
      const root = wrapper.body.firstElementChild
      if (!root) {
        return { ...doc, content: doc.text }
      }

      let cursor = 0
      const parts: string[] = []
      const shouldIgnore = (element: HTMLElement | null) => {
        if (!element) return false
        return Boolean(
          element.closest('.code-label') ||
            element.closest('.code-remove') ||
            element.closest('[data-non-editable="true"]'),
        )
      }

      const getCodeContentText = (element: HTMLElement) => {
        const content = element.querySelector('.code-content') as HTMLElement | null
        return content?.textContent ?? ''
      }

      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement
          if (shouldIgnore(parent)) return
          const text = node.textContent ?? ''
          parts.push(text)
          cursor += text.length
          return
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return

        const element = node as HTMLElement
        if (shouldIgnore(element)) return

        const codeId = element.getAttribute('data-code-id')
        if (codeId) {
          const text = getCodeContentText(element)
          const start = cursor
          const end = cursor + text.length
          highlights.push({
            id: `hl-${doc.id}-${start}-${end}-${codeId}`,
            document_id: doc.id,
            start_index: start,
            end_index: end,
            code_id: codeId,
          })
          parts.push(text)
          cursor = end
          return
        }

        Array.from(node.childNodes).forEach(walk)
      }

      Array.from(root.childNodes).forEach(walk)

      return {
        ...doc,
        content: parts.join(''),
      }
    })

    return {
      documents: parsedDocuments.map((doc) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content ?? doc.text,
      })),
      codes: codes.map((code) => ({
        id: code.id,
        name: code.label,
        color: code.colorHex ?? '#E2E8F0',
      })),
      highlights,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        contained_code_ids: category.codeIds,
        precondition: category.precondition ?? '',
        action: category.action ?? '',
        consequence: category.consequence ?? '',
      })),
      memos: memos.map((memo) => ({
        id: memo.id,
        title: memo.title,
        body: memo.body,
        createdAt: memo.createdAt,
        updatedAt: memo.updatedAt,
      })),
      core_category_id: coreCategoryId || null,
      theory_description: theoryHtml.replace(/<[^>]*>/g, '').trim(),
    }
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const getApiBase = () => {
    if (typeof window === 'undefined') return ''
    if (window.location.port === '5173') return 'http://localhost:8000'
    return window.location.origin
  }

  const handleSaveProject = () => {
    const payload = {
      version: 1,
      documents,
      codes,
      categories,
      memos,
      coreCategoryId,
      theoryHtml,
      activeDocumentId,
      documentViewMode,
      documentFontFamily,
      documentLineHeight,
      showCodeLabels,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    downloadBlob(blob, 'project_backup.json')
  }

  const handleLoadProject = async (file: File) => {
    const text = await file.text()
    const payload = JSON.parse(text) as {
      version?: number
      documents?: DocumentItem[]
      codes?: Code[]
      categories?: Category[]
      memos?: Memo[]
      coreCategoryId?: string
      theoryHtml?: string
      activeDocumentId?: string
      documentViewMode?: DocumentViewMode
      documentFontFamily?: string
      documentLineHeight?: string
      showCodeLabels?: boolean
    }

    if (payload.version && payload.documents?.length) {
      setDocuments(payload.documents)
      setActiveDocumentId(payload.activeDocumentId ?? payload.documents[0]?.id ?? 'doc-1')
      if (payload.codes) setCodes(payload.codes)
      if (payload.categories)
        setCategories(
          payload.categories.map((category) => ({
            ...category,
            precondition: category.precondition ?? '',
            action: category.action ?? '',
            consequence: category.consequence ?? '',
          })),
        )
      setMemos(
        (payload.memos ?? []).map((memo) => ({
          ...memo,
          createdAt: memo.createdAt ?? new Date().toISOString(),
          updatedAt: memo.updatedAt ?? new Date().toISOString(),
        })),
      )
      setCoreCategoryId(payload.coreCategoryId ?? '')
      setTheoryHtml(payload.theoryHtml ?? '')
      if (payload.documentViewMode) setDocumentViewMode(payload.documentViewMode)
      if (payload.documentFontFamily) {
        setDocumentFontFamily(payload.documentFontFamily)
        setDocumentFontFamilyDisplay(payload.documentFontFamily)
      }
      if (payload.documentLineHeight) setDocumentLineHeight(payload.documentLineHeight)
      if (typeof payload.showCodeLabels === 'boolean') setShowCodeLabels(payload.showCodeLabels)
      return
    }

    const legacy = JSON.parse(text) as {
      documents?: Array<{ id: string; title: string; content: string }>
      codes?: Array<{ id: string; name: string; color: string }>
      categories?: Array<{
        id: string
        name: string
        contained_code_ids: string[]
        precondition?: string
        action?: string
        consequence?: string
      }>
      core_category_id?: string | null
      theory_description?: string
    }

    if (legacy.documents?.length) {
      setDocuments(
        legacy.documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          text: doc.content,
          html: '',
        })),
      )
      setActiveDocumentId(legacy.documents[0].id)
    }
    if (legacy.codes) {
      setCodes(
        legacy.codes.map((code) => ({
          id: code.id,
          label: code.name,
          description: 'Imported code',
          colorClass: 'bg-slate-100 text-slate-700 ring-slate-200',
          colorHex: code.color,
          textHex: getReadableTextColor(code.color),
          ringHex: `${getReadableTextColor(code.color)}33`,
        })),
      )
    }
    if (legacy.categories) {
      setCategories(
        legacy.categories.map((category) => ({
          id: category.id,
          name: category.name,
          codeIds: category.contained_code_ids ?? [],
          precondition: category.precondition ?? '',
          action: category.action ?? '',
          consequence: category.consequence ?? '',
        })),
      )
    }
    setMemos([])
    setCoreCategoryId(legacy.core_category_id ?? '')
    if (legacy.theory_description) {
      setTheoryHtml(legacy.theory_description)
    }
  }

  const exportReport = async (format: 'word' | 'excel') => {
    const payload = buildProjectState()
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    const formData = new FormData()
    formData.append('file', blob, 'project.json')

    const apiBase = getApiBase()

    await fetch(`${apiBase}/project/load`, {
      method: 'POST',
      body: formData,
    })

    const response = await fetch(`${apiBase}/export/${format}`)
    if (!response.ok) return
    const fileBlob = await response.blob()
    downloadBlob(
      fileBlob,
      format === 'word' ? 'grounded_theory_report.docx' : 'grounded_theory_report.xlsx',
    )
  }

  return {
    handleSaveProject,
    handleLoadProject,
    exportReport,
    buildProjectState,
  }
}
