import { type WheelEvent, useMemo, useRef, useState } from 'react'
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
  kind: 'root' | 'category' | 'code' | 'excerpt' | 'memo' | 'theory'
  meta?: string
  payload?: TreeMapExcerptTarget
  children: TreeNode[]
}

type NodePosition = {
  x: number
  y: number
}

const COLUMN_WIDTH = 280
const ROW_HEIGHT = 90
const NODE_WIDTH = 240
const NODE_HEIGHT = 64
const CANVAS_PADDING = 80

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

  const codeById = useMemo(() => new Map(codes.map((code) => [code.id, code])), [codes])

  const codeExcerpts = useMemo(() => {
    const map = new Map<
      string,
      Array<{ docId: string; docTitle: string; text: string; highlightIndex: number }>
    >()
    const highlightIndexByKey = new Map<string, number>()
    documents.forEach((doc) => {
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
  }, [documents])

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
    const orderedCategories = [...categories].sort((a, b) => {
      if (a.id === coreCategoryId) return -1
      if (b.id === coreCategoryId) return 1
      return a.name.localeCompare(b.name)
    })

    if (showMemos) {
      const globalMemos = memos.filter((memo) => memo.type === 'global')
      globalMemos.forEach((memo) => {
        rootChildren.push({
          id: `memo-${memo.id}`,
          label: memo.title || 'Integrative Memo',
          meta: memo.body,
          kind: 'memo',
          children: [],
        })
      })
    }

    if (theoryExcerpt) {
      rootChildren.push({
        id: 'theory-narrative',
        label: 'Theory Narrative',
        meta: theoryExcerpt,
        kind: 'theory',
        children: [],
      })
    }

    orderedCategories.forEach((category) => {
      const categoryNode: TreeNode = {
        id: `category-${category.id}`,
        label: category.name,
        meta: category.id === coreCategoryId ? 'Core' : undefined,
        kind: 'category',
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
        const codeNode: TreeNode = {
          id: `code-${code.id}`,
          label: code.label,
          kind: 'code',
          children: [],
        }

        if (showMemos) {
          const codeMemos = memos.filter(
            (memo) => memo.type === 'code' && memo.refId === code.id,
          )
          codeMemos.forEach((memo) => {
            codeNode.children.push({
              id: `memo-${memo.id}`,
              label: memo.title || 'Code Note',
              meta: memo.body,
              kind: 'memo',
              children: [],
            })
          })
        }

        const excerpts = codeExcerpts.get(code.id) ?? []
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

      rootChildren.push(categoryNode)
    })

    return {
      id: 'root',
      label: rootLabel,
      kind: 'root',
      children: rootChildren,
    }
  }, [categories, coreCategoryId, codeById, codeExcerpts, memos, showMemos, theoryExcerpt])

  const { positions, edges, size } = useMemo(() => {
    const map = new Map<string, NodePosition>()
    const connections: Array<{ from: string; to: string }> = []

    const layout = (node: TreeNode, depth: number, row: number): number => {
      if (!node.children.length) {
        map.set(node.id, { x: depth * COLUMN_WIDTH, y: row * ROW_HEIGHT })
        return 1
      }

      let currentRow = row
      let span = 0
      node.children.forEach((child) => {
        connections.push({ from: node.id, to: child.id })
        const childSpan = layout(child, depth + 1, currentRow)
        currentRow += childSpan
        span += childSpan
      })

      const firstChild = node.children[0]
      const lastChild = node.children[node.children.length - 1]
      const firstPos = map.get(firstChild.id)
      const lastPos = map.get(lastChild.id)
      const midY =
        firstPos && lastPos ? (firstPos.y + lastPos.y) / 2 : row * ROW_HEIGHT
      map.set(node.id, { x: depth * COLUMN_WIDTH, y: midY })
      return span
    }

    const rows = layout(rootNode, 0, 0)
    const maxDepth = Math.max(...Array.from(map.values()).map((pos) => pos.x), 0)
    const maxY = Math.max(...Array.from(map.values()).map((pos) => pos.y), 0)

    return {
      positions: map,
      edges: connections,
      size: {
        width: maxDepth + COLUMN_WIDTH + CANVAS_PADDING * 2,
        height: maxY + ROW_HEIGHT + CANVAS_PADDING * 2,
        rows,
      },
    }
  }, [rootNode])

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.08 : 0.08
    setScale((current) => clamp(current + delta, 0.4, 2.4))
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsPanning(true)
    setPanAnchor({ x: event.clientX - offset.x, y: event.clientY - offset.y })
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return
    setOffset({ x: event.clientX - panAnchor.x, y: event.clientY - panAnchor.y })
  }

  const handlePointerUp = () => {
    setIsPanning(false)
  }

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
        <div className="flex items-center gap-2 text-xs text-slate-500">
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
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
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
              const from = positions.get(edge.from)
              const to = positions.get(edge.to)
              if (!from || !to) return null
              const startX = from.x + CANVAS_PADDING + NODE_WIDTH
              const startY = from.y + CANVAS_PADDING + NODE_HEIGHT / 2
              const endX = to.x + CANVAS_PADDING
              const endY = to.y + CANVAS_PADDING + NODE_HEIGHT / 2
              const midX = (startX + endX) / 2
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                  fill="none"
                  stroke="#CBD5F5"
                  strokeWidth={1.5}
                />
              )
            })}
          </svg>
          {Array.from(positions.entries()).map(([id, pos]) => {
            const node = findNode(rootNode, id)
            if (!node) return null
            const isClickable = node.kind === 'excerpt' && Boolean(onExcerptNavigate)
            return (
              <div
                key={id}
                className={cn(
                  'absolute rounded-xl border bg-white px-3 py-2 text-xs shadow-sm',
                  node.kind === 'root' && 'border-slate-900 bg-slate-900 text-white',
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
                onClick={() => {
                  if (node.kind !== 'excerpt' || !node.payload) return
                  onExcerptNavigate?.(node.payload)
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">
                    {node.kind === 'root' ? node.label : node.label}
                  </span>
                  {node.meta && node.kind !== 'theory' ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                      {node.meta}
                    </span>
                  ) : null}
                </div>
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
              </div>
            )
          })}
        </div>
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
