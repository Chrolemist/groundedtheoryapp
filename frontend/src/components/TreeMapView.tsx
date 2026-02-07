import { useEffect, useMemo, useRef, useState } from 'react'
import { type Category, type Code, type Memo } from '../types'
import { type DocumentItem } from './DashboardLayout.types'
import { cn } from '../lib/cn'

export type TreeMapExcerptTarget = {
  docId: string
  codeId: string
  highlightIndex?: number
  excerptText?: string
}

type TreeMapViewProps = {
  documents: DocumentItem[]
  codes: Code[]
  categories: Category[]
  memos: Memo[]
  coreCategoryId: string
  showMemos: boolean
  theoryHtml: string
  onExcerptNavigate?: (target: TreeMapExcerptTarget) => void
}

type TreeNode = {
  id: string
  label: string
  kind: 'root' | 'core' | 'category' | 'code' | 'excerpt' | 'memo' | 'theory'
  meta?: string
  memoNotes?: Array<{ title: string; body: string }>
  logic?: {
    precondition: string
    action: string
    consequence: string
  }
  payload?: TreeMapExcerptTarget
  children: TreeNode[]
}

type NodePosition = {
  x: number
  y: number
}

const NODE_WIDTH = 240
const NODE_HEIGHT = 64
const CANVAS_PADDING = 80
const NODE_GAP_X = 60
const NODE_GAP_Y = 40
const HORIZONTAL_COLUMN_WIDTH = NODE_WIDTH + NODE_GAP_X
const HORIZONTAL_ROW_HEIGHT = NODE_HEIGHT + NODE_GAP_Y
const VERTICAL_COLUMN_WIDTH = NODE_WIDTH + NODE_GAP_X + 20
const VERTICAL_ROW_HEIGHT = NODE_HEIGHT + NODE_GAP_Y + 30

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const formatExcerpt = (value: string) => {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= 140) return trimmed
  return `${trimmed.slice(0, 140)}...`
}

export function TreeMapView({
  documents,
  codes,
  categories,
  memos,
  coreCategoryId,
  showMemos,
  theoryHtml,
  onExcerptNavigate,
}: TreeMapViewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.9)
  const [offset, setOffset] = useState({ x: 40, y: 40 })
  const [isPanning, setIsPanning] = useState(false)
  const [panAnchor, setPanAnchor] = useState({ x: 0, y: 0 })
  const [selectedDocId, setSelectedDocId] = useState('__all__')
  const [showLogic, setShowLogic] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = window.localStorage.getItem('gt-theory-map-layout')
    if (!saved) return true
    try {
      const parsed = JSON.parse(saved) as { showLogic?: boolean }
      return typeof parsed.showLogic === 'boolean' ? parsed.showLogic : true
    } catch {
      return true
    }
  })
  const [layoutOrientation, setLayoutOrientation] = useState<'horizontal' | 'vertical'>(() => {
    if (typeof window === 'undefined') return 'vertical'
    const saved = window.localStorage.getItem('gt-theory-map-layout')
    if (!saved) return 'vertical'
    try {
      const parsed = JSON.parse(saved) as { layoutOrientation?: 'horizontal' | 'vertical' }
      return parsed.layoutOrientation === 'vertical' ? 'vertical' : 'horizontal'
    } catch {
      return 'vertical'
    }
  })
  const [useManualLayout, setUseManualLayout] = useState(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('gt-theory-map-layout')
    if (!saved) return false
    try {
      const parsed = JSON.parse(saved) as { useManualLayout?: boolean }
      return typeof parsed.useManualLayout === 'boolean' ? parsed.useManualLayout : false
    } catch {
      return false
    }
  })
  const [manualPositions, setManualPositions] = useState<Record<string, NodePosition>>(() => {
    if (typeof window === 'undefined') return {}
    const saved = window.localStorage.getItem('gt-theory-map-layout')
    if (!saved) return {}
    try {
      const parsed = JSON.parse(saved) as { manualPositions?: Record<string, NodePosition> }
      return parsed.manualPositions ?? {}
    } catch {
      return {}
    }
  })
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const dragMovedRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const isFiltered = selectedDocId !== '__all__'

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload = {
      manualPositions,
      useManualLayout,
      layoutOrientation,
      showLogic,
    }
    window.localStorage.setItem('gt-theory-map-layout', JSON.stringify(payload))
  }, [layoutOrientation, manualPositions, showLogic, useManualLayout])

  const codeById = useMemo(() => new Map(codes.map((code) => [code.id, code])), [codes])

  const visibleDocuments = useMemo(() => {
    if (selectedDocId === '__all__') return documents
    return documents.filter((doc) => doc.id === selectedDocId)
  }, [documents, selectedDocId])

  const codeExcerpts = useMemo(() => {
    const map = new Map<
      string,
      Array<{ docId: string; docTitle: string; text: string; highlightIndex: number }>
    >()
    const highlightIndexByKey = new Map<string, number>()
    visibleDocuments.forEach((doc) => {
      if (!doc.html) return
      const parser = new DOMParser()
      const wrapper = parser.parseFromString(`<div>${doc.html}</div>`, 'text/html')
      const container = wrapper.body.firstElementChild
      if (!container) return
      const highlights = container.querySelectorAll('span[data-code-id]')
      highlights.forEach((highlight) => {
        const codeId = highlight.getAttribute('data-code-id')
        if (!codeId) return
        const content = highlight.querySelector('.code-content') as HTMLElement | null
        const text = content?.textContent ?? highlight.textContent ?? ''
        const trimmed = text.trim()
        if (!trimmed) return
        const key = `${doc.id}:${codeId}`
        const nextIndex = (highlightIndexByKey.get(key) ?? 0) + 1
        highlightIndexByKey.set(key, nextIndex)
        const list = map.get(codeId) ?? []
        list.push({
          docId: doc.id,
          docTitle: doc.title,
          text: trimmed,
          highlightIndex: nextIndex - 1,
        })
        map.set(codeId, list)
      })
    })
    return map
  }, [visibleDocuments])

  const hasVisibleExcerpts = codeExcerpts.size > 0

  const theoryExcerpt = useMemo(() => {
    if (!theoryHtml) return ''
    const parser = new DOMParser()
    const wrapper = parser.parseFromString(`<div>${theoryHtml}</div>`, 'text/html')
    const container = wrapper.body.firstElementChild
    const text = container?.textContent ?? ''
    return text.replace(/\s+/g, ' ').trim()
  }, [theoryHtml])

  const rootNode = useMemo<TreeNode>(() => {
    const rootLabel = coreCategoryId ? 'Core Category' : 'Categories'
    const rootChildren: TreeNode[] = []
    const memoNodes: TreeNode[] = []
    const orderedCategories = [...categories].sort((a, b) => {
      if (a.id === coreCategoryId) return 1
      if (b.id === coreCategoryId) return -1
      return a.name.localeCompare(b.name)
    })

    if (showMemos) {
      const globalMemos = memos.filter((memo) => memo.type === 'global')
      globalMemos.forEach((memo) => {
        memoNodes.push({
          id: `memo-${memo.id}`,
          label: memo.title || 'Integrative Memo',
          meta: memo.body,
          kind: 'memo',
          children: [],
        })
      })
    }

    const buildTheoryNode = () =>
      ({
        id: 'theory-narrative',
        label: 'Theory Narrative',
        meta: theoryExcerpt,
        kind: 'theory',
        children: [],
      }) satisfies TreeNode

    const categoryNodes = orderedCategories.reduce<TreeNode[]>((acc, category) => {
      const isCore = category.id === coreCategoryId
      const hasLogic =
        Boolean(category.precondition?.trim()) ||
        Boolean(category.action?.trim()) ||
        Boolean(category.consequence?.trim())
      const categoryNode: TreeNode = {
        id: `category-${category.id}`,
        label: category.name,
        meta: isCore ? 'Core' : undefined,
        logic: hasLogic
          ? {
              precondition: category.precondition?.trim() ?? '',
              action: category.action?.trim() ?? '',
              consequence: category.consequence?.trim() ?? '',
            }
          : undefined,
        kind: isCore ? 'core' : 'category',
        children: [],
      }

      if (showMemos) {
        const categoryMemos = memos.filter(
          (memo) => memo.type === 'category' && memo.refId === category.id,
        )
        categoryMemos.forEach((memo) => {
          categoryNode.children.push({
            id: `memo-${memo.id}`,
            label: memo.title || 'Theoretical Note',
            meta: memo.body,
            kind: 'memo',
            children: [],
          })
        })
      }

      category.codeIds.forEach((codeId) => {
        const code = codeById.get(codeId)
        if (!code) return
        const excerpts = codeExcerpts.get(code.id) ?? []
        if (isFiltered && excerpts.length === 0) return
        const codeMemos = showMemos
          ? memos.filter((memo) => memo.type === 'code' && memo.refId === code.id)
          : []
        const codeNode: TreeNode = {
          id: `code-${code.id}`,
          label: code.label,
          kind: 'code',
          memoNotes: codeMemos.map((memo) => ({
            title: memo.title || 'Code Note',
            body: memo.body,
          })),
          children: [],
        }

        excerpts.forEach((excerpt, index) => {
          codeNode.children.push({
            id: `excerpt-${code.id}-${index}`,
            label: formatExcerpt(excerpt.text),
            meta: excerpt.docTitle,
            kind: 'excerpt',
            payload: {
              docId: excerpt.docId,
              codeId: code.id,
              highlightIndex: excerpt.highlightIndex,
              excerptText: excerpt.text,
            },
            children: [],
          })
        })

        categoryNode.children.push(codeNode)
      })
      if (isFiltered && categoryNode.children.length === 0) {
        return acc
      }
      acc.push(categoryNode)
      return acc
    }, [])

      if (memoNodes.length) {
        rootChildren.push(...memoNodes)
      }

      const coreNode = categoryNodes.find((node) => node.kind === 'core') ?? null
      const nonCoreNodes = categoryNodes.filter((node) => node.kind !== 'core')

      if (coreNode) {
        coreNode.children = nonCoreNodes
      }

      const shouldShowTheory = Boolean(theoryExcerpt || coreNode || nonCoreNodes.length)
      if (shouldShowTheory) {
        const theoryNode = buildTheoryNode() as TreeNode
        theoryNode.children = coreNode ? [coreNode] : nonCoreNodes
        rootChildren.push(theoryNode)
      } else if (coreNode) {
        rootChildren.push(coreNode)
      } else {
        rootChildren.push(...nonCoreNodes)
      }

    return {
      id: 'root',
      label: rootLabel,
      kind: 'root',
      children: rootChildren,
    }
  }, [categories, coreCategoryId, codeById, codeExcerpts, isFiltered, memos, showMemos, theoryExcerpt])

  const { positions, edges, size } = useMemo(() => {
    const map = new Map<string, NodePosition>()
    const connections: Array<{ from: string; to: string }> = []

    const getPosition = (depth: number, row: number) => {
      if (layoutOrientation === 'vertical') {
        return { x: row * VERTICAL_COLUMN_WIDTH, y: depth * VERTICAL_ROW_HEIGHT }
      }
      return { x: depth * HORIZONTAL_COLUMN_WIDTH, y: row * HORIZONTAL_ROW_HEIGHT }
    }

    const layout = (node: TreeNode, depth: number, row: number, isRoot = false): number => {
      if (!node.children.length) {
        map.set(node.id, getPosition(depth, row))
        return 1
      }

      let currentRow = row
      let span = 0
      node.children.forEach((child) => {
        if (!isRoot) {
          connections.push({ from: node.id, to: child.id })
        }
        const childSpan = layout(child, depth + 1, currentRow)
        currentRow += childSpan
        span += childSpan
      })

      const firstChild = node.children[0]
      const lastChild = node.children[node.children.length - 1]
      const firstPos = map.get(firstChild.id)
      const lastPos = map.get(lastChild.id)
      if (layoutOrientation === 'vertical') {
        const baseX =
          firstPos && lastPos
            ? (firstPos.x + lastPos.x) / 2
            : getPosition(depth, row).x
        map.set(node.id, { x: baseX, y: depth * VERTICAL_ROW_HEIGHT })
      } else {
        const baseY =
          firstPos && lastPos
            ? (firstPos.y + lastPos.y) / 2
            : getPosition(depth, row).y
        map.set(node.id, { x: depth * HORIZONTAL_COLUMN_WIDTH, y: baseY })
      }
      return span
    }

    const rows = layout(rootNode, 0, 0, true)
    const maxX = Math.max(...Array.from(map.values()).map((pos) => pos.x), 0)
    const maxY = Math.max(...Array.from(map.values()).map((pos) => pos.y), 0)

    return {
      positions: map,
      edges: connections,
      size: {
        width:
          maxX +
          (layoutOrientation === 'vertical'
            ? VERTICAL_COLUMN_WIDTH
            : HORIZONTAL_COLUMN_WIDTH) +
          CANVAS_PADDING * 2,
        height:
          maxY +
          (layoutOrientation === 'vertical'
            ? VERTICAL_ROW_HEIGHT
            : HORIZONTAL_ROW_HEIGHT) +
          CANVAS_PADDING * 2,
        rows,
      },
    }
  }, [layoutOrientation, rootNode])

  const getEdgePath = (from: NodePosition, to: NodePosition) => {
    if (layoutOrientation === 'vertical') {
      const startX = from.x + CANVAS_PADDING + NODE_WIDTH / 2
      const startY = from.y + CANVAS_PADDING + NODE_HEIGHT
      const endX = to.x + CANVAS_PADDING + NODE_WIDTH / 2
      const endY = to.y + CANVAS_PADDING
      const midY = (startY + endY) / 2
      return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`
    }

    const startX = from.x + CANVAS_PADDING + NODE_WIDTH
    const startY = from.y + CANVAS_PADDING + NODE_HEIGHT / 2
    const endX = to.x + CANVAS_PADDING
    const endY = to.y + CANVAS_PADDING + NODE_HEIGHT / 2
    const midX = (startX + endX) / 2
    return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`
  }

  useEffect(() => {
    const node = wrapperRef.current
    if (!node) return
    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault()
      const delta = event.deltaY > 0 ? -0.08 : 0.08
      setScale((current) => clamp(current + delta, 0.4, 2.4))
    }
    node.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      node.removeEventListener('wheel', handleWheel)
    }
  }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsPanning(true)
    setPanAnchor({ x: event.clientX - offset.x, y: event.clientY - offset.y })
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingNodeId) {
      const canvasX = (event.clientX - offset.x) / scale
      const canvasY = (event.clientY - offset.y) / scale
      const movedX = Math.abs(event.clientX - dragStartRef.current.x)
      const movedY = Math.abs(event.clientY - dragStartRef.current.y)
      if (movedX > 4 || movedY > 4) {
        dragMovedRef.current = true
      }
      setManualPositions((current) => ({
        ...current,
        [draggingNodeId]: {
          x: canvasX - dragOffset.x,
          y: canvasY - dragOffset.y,
        },
      }))
      return
    }
    if (!isPanning) return
    setOffset({ x: event.clientX - panAnchor.x, y: event.clientY - panAnchor.y })
  }

  const handlePointerUp = () => {
    setIsPanning(false)
    setDraggingNodeId(null)
    window.setTimeout(() => {
      dragMovedRef.current = false
    }, 0)
  }

  const renderPositions = useMemo(() => {
    if (!useManualLayout) return positions
    const next = new Map(positions)
    Object.entries(manualPositions).forEach(([id, pos]) => {
      if (next.has(id)) {
        next.set(id, pos)
      }
    })
    return next
  }, [manualPositions, positions, useManualLayout])

  const renderPositionsRef = useRef(renderPositions)
  useEffect(() => {
    renderPositionsRef.current = renderPositions
  }, [renderPositions])

  return (
    <section
      id="theory-map-view"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
        <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Theory Map</p>
          <p className="text-xs text-slate-500">
            Zoom with mouse wheel, drag to pan, scroll to explore.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => setUseManualLayout((current) => !current)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
          >
            {useManualLayout ? 'Lås noder' : 'Lås upp noder'}
          </button>
          {useManualLayout ? (
            <button
              type="button"
              onClick={() => {
                setManualPositions({})
                setUseManualLayout(false)
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
            >
              Återställ layout
            </button>
          ) : null}
          <button
            type="button"
            onClick={() =>
              setLayoutOrientation((current) =>
                current === 'horizontal' ? 'vertical' : 'horizontal',
              )
            }
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
          >
            {layoutOrientation === 'horizontal' ? 'Vertikal vy' : 'Horisontell vy'}
          </button>
          <button
            type="button"
            onClick={() => setShowLogic((current) => !current)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
          >
            {showLogic ? 'Dolj logik' : 'Visa logik'}
          </button>
          <select
            id="theory-map-document-filter"
            name="theory-map-document-filter"
            value={selectedDocId}
            onChange={(event) => setSelectedDocId(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
          >
            <option value="__all__">All documents</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
              </option>
            ))}
          </select>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
            Nodes: {positions.size}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
            Links: {edges.length}
          </span>
        </div>
      </div>

      <div
        ref={wrapperRef}
        className="relative mt-4 h-[620px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {isFiltered && !hasVisibleExcerpts ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
            Inga kopplingar hittades för det här dokumentet.
          </div>
        ) : (
          <div
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              width: size.width,
              height: size.height,
            }}
          >
            <svg
              width={size.width}
              height={size.height}
              className="absolute left-0 top-0"
            >
              {edges.map((edge) => {
                const from = renderPositions.get(edge.from)
                const to = renderPositions.get(edge.to)
                if (!from || !to) return null
                return (
                  <path
                    key={`${edge.from}-${edge.to}`}
                    d={getEdgePath(from, to)}
                    fill="none"
                    stroke="#CBD5F5"
                    strokeWidth={1.5}
                  />
                )
              })}
            </svg>
            {Array.from(renderPositions.entries()).map(([id, pos]) => {
              const node = findNode(rootNode, id)
              if (!node || node.kind === 'root') return null
              const isClickable = node.kind === 'excerpt' && Boolean(onExcerptNavigate)
              return (
                <div
                  key={id}
                  className={cn(
                    'absolute rounded-xl border bg-white px-3 py-2 text-xs shadow-sm',
                    node.kind === 'core' && 'border-slate-900 bg-slate-900 text-white',
                    node.kind === 'category' && 'border-slate-200',
                    node.kind === 'code' && 'border-slate-200 bg-slate-50',
                    node.kind === 'excerpt' &&
                      'border-dashed border-slate-300 bg-white transition hover:border-slate-400 hover:bg-white',
                    node.kind === 'memo' && 'border-amber-200 bg-amber-50',
                    node.kind === 'theory' && 'border-emerald-200 bg-emerald-50',
                    isClickable && 'cursor-pointer',
                  )}
                  style={{
                    left: pos.x + CANVAS_PADDING,
                    top: pos.y + CANVAS_PADDING,
                    width: NODE_WIDTH,
                    minHeight: NODE_HEIGHT,
                  }}
                  data-node-id={id}
                  onPointerDown={(event) => {
                    if (!useManualLayout) return
                    event.preventDefault()
                    event.stopPropagation()
                    dragMovedRef.current = false
                    dragStartRef.current = { x: event.clientX, y: event.clientY }
                    const canvasX = (event.clientX - offset.x) / scale
                    const canvasY = (event.clientY - offset.y) / scale
                    const currentPos = renderPositionsRef.current.get(id) ?? pos
                    setDraggingNodeId(id)
                    setDragOffset({
                      x: canvasX - currentPos.x,
                      y: canvasY - currentPos.y,
                    })
                  }}
                  onClick={() => {
                    if (dragMovedRef.current) return
                    if (node.kind !== 'excerpt' || !node.payload) return
                    onExcerptNavigate?.(node.payload)
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'font-semibold',
                        node.kind === 'core' ? 'text-white' : 'text-slate-900',
                      )}
                    >
                      {node.label}
                    </span>
                    {node.meta && node.kind !== 'theory' ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        {node.meta}
                      </span>
                    ) : null}
                  </div>
                  {showLogic && node.logic ? (
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      {node.logic.precondition ? (
                        <p>
                          <span className="font-semibold">Forutsattning:</span>{' '}
                          {formatExcerpt(node.logic.precondition)}
                        </p>
                      ) : null}
                      {node.logic.action ? (
                        <p>
                          <span className="font-semibold">Handling:</span>{' '}
                          {formatExcerpt(node.logic.action)}
                        </p>
                      ) : null}
                      {node.logic.consequence ? (
                        <p>
                          <span className="font-semibold">Konsekvens:</span>{' '}
                          {formatExcerpt(node.logic.consequence)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {node.kind === 'excerpt' && node.meta ? (
                    <p className="mt-1 text-[11px] text-slate-500">{node.meta}</p>
                  ) : null}
                  {node.kind === 'theory' && node.meta ? (
                    <p className="mt-1 text-[11px] text-slate-600">
                      {formatExcerpt(node.meta)}
                    </p>
                  ) : null}
                  {node.kind === 'memo' && node.meta ? (
                    <p className="mt-1 text-[11px] text-slate-600">
                      {formatExcerpt(node.meta)}
                    </p>
                  ) : null}
                  {node.kind === 'code' && node.memoNotes?.length ? (
                    <div className="mt-1 space-y-1 text-[11px] text-slate-600">
                      {node.memoNotes.map((memo, index) => (
                        <p key={`${node.id}-memo-${index}`}>
                          <span className="font-semibold">{memo.title}:</span>{' '}
                          {formatExcerpt(memo.body)}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

const findNode = (root: TreeNode, targetId: string): TreeNode | null => {
  if (root.id === targetId) return root
  for (const child of root.children) {
    const found = findNode(child, targetId)
    if (found) return found
  }
  return null
}
