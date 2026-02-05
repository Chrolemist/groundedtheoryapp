import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import {
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { type Category, type Code, type Memo } from '../types'
import { type DocumentItem } from '../components/DashboardLayout.types'

type UseCodingStateArgs = {
  storedState: {
    codes?: Code[]
    categories?: Category[]
    memos?: Memo[]
    theoryHtml?: string
    coreCategoryId?: string
  } | null
  pushHistoryRef: MutableRefObject<() => void>
  setDocuments: Dispatch<SetStateAction<DocumentItem[]>>
  syncDocumentsForCodes: (current: DocumentItem[], nextCodeMap: Map<string, Code>) => DocumentItem[]
  syncEditorForCodes: (nextCodeMap: Map<string, Code>) => void
}

// Coding state for codes, categories, memos, theory, and drag handling.
export function useCodingState({
  storedState,
  pushHistoryRef,
  setDocuments,
  syncDocumentsForCodes,
  syncEditorForCodes,
}: UseCodingStateArgs) {
  const [codes, setCodes] = useState<Code[]>(() => storedState?.codes ?? [])
  const [categories, setCategories] = useState<Category[]>(() => storedState?.categories ?? [])
  const [memos, setMemos] = useState<Memo[]>(() => storedState?.memos ?? [])
  const [coreCategoryId, setCoreCategoryId] = useState(() => storedState?.coreCategoryId ?? '')
  const [coreCategoryDraft, setCoreCategoryDraft] = useState('')
  const [theoryHtml, setTheoryHtml] = useState(() => storedState?.theoryHtml ?? '')
  const [showCodeLabels, setShowCodeLabels] = useState(true)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const theoryEditorRef = useRef<HTMLDivElement | null>(null)

  const codeById = useMemo(() => {
    return new Map(codes.map((code) => [code.id, code]))
  }, [codes])

  const assignedCodeIds = useMemo(() => {
    return new Set(categories.flatMap((category) => category.codeIds))
  }, [categories])

  const ungroupedCodes = useMemo(() => {
    return codes.filter((code) => !assignedCodeIds.has(code.id))
  }, [codes, assignedCodeIds])

  const categoryStats = useMemo(() => {
    return categories
      .map((category) => {
        const codesInCategory = category.codeIds
          .map((codeId) => codeById.get(codeId))
          .filter((code): code is Code => Boolean(code))
        return {
          id: category.id,
          name: category.name,
          codeCount: codesInCategory.length,
          codes: codesInCategory,
        }
      })
      .sort((a, b) => b.codeCount - a.codeCount)
  }, [categories, codeById])

  const sharedCodes = useMemo(() => {
    const counts = new Map<string, number>()
    categories.forEach((category) => {
      category.codeIds.forEach((codeId) => {
        counts.set(codeId, (counts.get(codeId) ?? 0) + 1)
      })
    })

    return Array.from(counts.entries())
      .map(([codeId, count]) => ({ code: codeById.get(codeId), count }))
      .filter((entry): entry is { code: Code; count: number } => Boolean(entry.code))
      .sort((a, b) => b.count - a.count)
  }, [categories, codeById])

  const isTheoryEmpty = theoryHtml.replace(/<[^>]*>/g, '').trim().length === 0
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const activeCode = activeDragId ? codeById.get(activeDragId) ?? null : null

  const getReadableTextColor = (hex: string) => {
    const value = hex.replace('#', '')
    const r = parseInt(value.slice(0, 2), 16)
    const g = parseInt(value.slice(2, 4), 16)
    const b = parseInt(value.slice(4, 6), 16)
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    return luminance > 0.6 ? '#0F172A' : '#0B1120'
  }

  const highlightPalette = useMemo(
    () => [
      { bg: '#FEF3C7', text: '#92400E' },
      { bg: '#E0F2FE', text: '#075985' },
      { bg: '#D1FAE5', text: '#065F46' },
      { bg: '#FFE4E6', text: '#9F1239' },
      { bg: '#EDE9FE', text: '#5B21B6' },
      { bg: '#FCE7F3', text: '#9D174D' },
      { bg: '#DCFCE7', text: '#166534' },
      { bg: '#FFEDD5', text: '#9A3412' },
    ],
    [],
  )

  const getNextPalette = () => {
    const used = new Set(codes.map((code) => code.colorHex))
    const available = highlightPalette.find((palette) => !used.has(palette.bg))
    return available ?? highlightPalette[codes.length % highlightPalette.length]
  }

  const addNewCode = () => {
    pushHistoryRef.current()
    const palette = getNextPalette()
    const name = `New Code ${codes.length + 1}`
    const newCode: Code = {
      id: `code-${crypto.randomUUID()}`,
      label: name,
      description: 'Custom code',
      colorClass: 'bg-slate-100 text-slate-700 ring-slate-200',
      colorHex: palette.bg,
      textHex: palette.text ?? getReadableTextColor(palette.bg),
      ringHex: `${palette.text ?? '#0F172A'}33`,
    }
    setCodes((current) => [...current, newCode])
  }

  const updateCode = (codeId: string, patch: Partial<Code>) => {
    setCodes((current) => {
      const nextCodes = current.map((code) =>
        code.id === codeId ? { ...code, ...patch } : code,
      )
      const nextCodeMap = new Map(nextCodes.map((code) => [code.id, code]))
      setDocuments((docs) => syncDocumentsForCodes(docs, nextCodeMap))
      syncEditorForCodes(nextCodeMap)
      return nextCodes
    })
  }

  const removeCode = (codeId: string) => {
    pushHistoryRef.current()
    setCodes((current) => current.filter((code) => code.id !== codeId))
    setCategories((current) =>
      current.map((category) => ({
        ...category,
        codeIds: category.codeIds.filter((id) => id !== codeId),
      })),
    )

    setDocuments((current) =>
      current.map((doc) => {
        if (!doc.html) return doc
        const container = document.createElement('div')
        container.innerHTML = doc.html
        container.querySelectorAll(`span[data-code-id="${codeId}"]`).forEach((span) => {
          span.replaceWith(document.createTextNode(span.textContent ?? ''))
        })
        return { ...doc, html: container.innerHTML, text: container.innerText }
      }),
    )
  }

  const updateCategory = (categoryId: string, patch: Partial<Category>) => {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, ...patch } : category,
      ),
    )
  }

  const handleAddCategory = () => {
    pushHistoryRef.current()
    const id = `category-${crypto.randomUUID()}`
    setCategories((current) => [
      ...current,
      {
        id,
        name: 'New Category',
        codeIds: [],
        precondition: '',
        action: '',
        consequence: '',
      },
    ])
  }

  const removeCategory = (categoryId: string) => {
    pushHistoryRef.current()
    setCategories((current) => current.filter((category) => category.id !== categoryId))
  }

  const removeCodeFromCategory = (categoryId: string, codeId: string) => {
    pushHistoryRef.current()
    setCategories((current) =>
      current.map((category) => {
        if (category.id !== categoryId) return category
        return { ...category, codeIds: category.codeIds.filter((id) => id !== codeId) }
      }),
    )
  }

  const handleAddMemo = () => {
    pushHistoryRef.current()
    const now = new Date().toISOString()
    const memo: Memo = {
      id: `memo-${crypto.randomUUID()}`,
      title: `Memo ${now.slice(0, 10)}`,
      body: '',
      createdAt: now,
      updatedAt: now,
    }
    setMemos((current) => [memo, ...current])
  }

  const updateMemo = (memoId: string, patch: Partial<Memo>) => {
    setMemos((current) =>
      current.map((memo) =>
        memo.id === memoId
          ? {
              ...memo,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : memo,
      ),
    )
  }

  const removeMemo = (memoId: string) => {
    pushHistoryRef.current()
    setMemos((current) => current.filter((memo) => memo.id !== memoId))
  }

  const handleCreateCoreCategory = () => {
    const name = coreCategoryDraft.trim()
    if (!name) return
    const existing = categories.find(
      (category) => category.name.trim().toLowerCase() === name.toLowerCase(),
    )
    if (existing) {
      setCoreCategoryId(existing.id)
      setCoreCategoryDraft('')
      return
    }
    pushHistoryRef.current()
    const id = `category-${crypto.randomUUID()}`
    setCategories((current) => [
      ...current,
      {
        id,
        name,
        codeIds: [],
        precondition: '',
        action: '',
        consequence: '',
      },
    ])
    setCoreCategoryId(id)
    setCoreCategoryDraft('')
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    if (!event.over) return

    const targetId = String(event.over.id)
    if (!targetId.startsWith('category-')) return

    const movedCodeId = String(event.active.id)
    setCategories((current) =>
      current.map((category) => {
        const filtered = category.codeIds.filter((id) => id !== movedCodeId)
        if (category.id !== targetId) return { ...category, codeIds: filtered }
        if (filtered.includes(movedCodeId)) return { ...category, codeIds: filtered }
        return { ...category, codeIds: [...filtered, movedCodeId] }
      }),
    )
  }

  useEffect(() => {
    const editor = theoryEditorRef.current
    if (!editor) return
    if (document.activeElement === editor) return
    if (editor.innerHTML !== theoryHtml) {
      editor.innerHTML = theoryHtml
    }
  }, [theoryHtml])

  return {
    codes,
    setCodes,
    categories,
    setCategories,
    memos,
    setMemos,
    coreCategoryId,
    setCoreCategoryId,
    coreCategoryDraft,
    setCoreCategoryDraft,
    theoryHtml,
    setTheoryHtml,
    showCodeLabels,
    setShowCodeLabels,
    codeById,
    assignedCodeIds,
    ungroupedCodes,
    categoryStats,
    sharedCodes,
    isTheoryEmpty,
    sensors,
    activeCode,
    getReadableTextColor,
    addNewCode,
    updateCode,
    removeCode,
    updateCategory,
    handleAddCategory,
    removeCategory,
    removeCodeFromCategory,
    handleAddMemo,
    updateMemo,
    removeMemo,
    handleCreateCoreCategory,
    handleDragStart,
    handleDragEnd,
    theoryEditorRef,
    setTheoryEditorRef: (node: HTMLDivElement | null) => {
      theoryEditorRef.current = node
    },
  }
}
