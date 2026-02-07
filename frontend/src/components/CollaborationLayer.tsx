import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { type CursorPresence, type PresenceUser, type SelectionPresence } from './DashboardLayout.types'

type CollaborationLayerProps = {
  remoteCursors: Record<string, CursorPresence>
  remoteSelections: Record<string, SelectionPresence>
  presenceById: Map<string, PresenceUser>
  localUser: PresenceUser | null
  documentEditorInstancesRef: React.MutableRefObject<Map<string, Editor>>
}

// Floating collaboration cursors.
export function CollaborationLayer({
  remoteCursors,
  remoteSelections,
  presenceById,
  localUser,
  documentEditorInstancesRef,
}: CollaborationLayerProps) {
  const [, forceRender] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const schedule = () => {
      if (rafRef.current) return
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null
        forceRender((value) => value + 1)
      })
    }

    const handleScroll = () => schedule()
    const handleResize = () => schedule()

    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])

  const overlays: Array<React.ReactNode> = []

  const renderCursor = (userId: string, cursor: CursorPresence) => {
    if (localUser?.id === userId) return null
    const user = presenceById.get(userId)
    if (!user) return null

    if (typeof cursor.docPos === 'number') {
      const editor = documentEditorInstancesRef.current.get(cursor.documentId ?? '')
      if (editor) {
        try {
          const coords = editor.view.coordsAtPos(cursor.docPos)
          const caretHeight = Math.max(2, coords.bottom - coords.top)
          return (
            <div key={userId} className="absolute" style={{ left: coords.left, top: coords.top }}>
              <div
                className="w-0.5"
                style={{ backgroundColor: user.color, height: caretHeight }}
              />
              <div
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow"
                style={{
                  backgroundColor: user.color,
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  transform: 'translateY(-100%)',
                  marginTop: -4,
                }}
              >
                {user.name}
              </div>
            </div>
          )
        } catch {
          // Fall back to raw cursor coords below.
        }
      }
    }

    const field = cursor.fieldId ? document.getElementById(cursor.fieldId) : null
    const fieldRect = field?.getBoundingClientRect()
    const container = cursor.documentId
      ? (document.querySelector(
          `[data-doc-id="${cursor.documentId}"] .document-content`,
        ) as HTMLElement | null)
      : null
    const containerRect = cursor.absolute ? null : container?.getBoundingClientRect()
    const baseRect = fieldRect ?? containerRect
    const left = baseRect ? baseRect.left + cursor.x : cursor.x
    const top = baseRect ? baseRect.top + cursor.y : cursor.y
    const caretHeight = Math.max(2, cursor.height ?? 20)

    return (
      <div key={userId} className="absolute" style={{ left, top }}>
        <div
          className="w-0.5"
          style={{ backgroundColor: user.color, height: caretHeight }}
        />
        <div
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow"
          style={{
            backgroundColor: user.color,
            position: 'absolute',
            left: 0,
            top: 0,
            transform: 'translateY(-100%)',
            marginTop: -4,
          }}
        >
          {user.name}
        </div>
      </div>
    )
  }

  const renderSelection = (userId: string, selection: SelectionPresence) => {
    if (localUser?.id === userId) return null
    const user = presenceById.get(userId)
    if (!user) return null
    const container = document.querySelector(
      `[data-doc-id="${selection.documentId}"] .document-content`,
    ) as HTMLElement | null
    if (selection.rects?.length && container) {
      const containerRect = container.getBoundingClientRect()
      return selection.rects.map((rect, index) => (
        <div
          key={`${userId}-${selection.documentId}-${index}`}
          className="absolute"
          style={{
            left: containerRect.left + rect.x,
            top: containerRect.top + rect.y,
            width: rect.width,
            height: rect.height,
            backgroundColor: user.color,
            opacity: 0.15,
            borderRadius: 3,
          }}
        />
      ))
    }

    const from = Math.min(selection.from, selection.to)
    const to = Math.max(selection.from, selection.to)
    if (from === to) return null

    const editor = documentEditorInstancesRef.current.get(selection.documentId)
    if (!editor) return null
    try {
      const domFrom = editor.view.domAtPos(from)
      const domTo = editor.view.domAtPos(to)
      const range = document.createRange()
      range.setStart(domFrom.node, domFrom.offset)
      range.setEnd(domTo.node, domTo.offset)
      const rects = Array.from(range.getClientRects())
      return rects.map((rect, index) => (
        <div
          key={`${userId}-${selection.documentId}-${index}`}
          className="absolute"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            border: `1px solid ${user.color}`,
            borderRadius: 4,
          }}
        />
      ))
    } catch {
      return null
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {Object.entries(remoteSelections).map(([userId, selection]) => {
        const selectionOverlays = renderSelection(userId, selection)
        if (selectionOverlays) {
          if (Array.isArray(selectionOverlays)) overlays.push(...selectionOverlays)
          else overlays.push(selectionOverlays)
        }
        return null
      })}
      {Object.entries(remoteCursors).map(([userId, cursor]) => {
        const overlay = renderCursor(userId, cursor)
        if (overlay) overlays.push(overlay)
        return null
      })}
      {overlays}
    </div>
  )
}
