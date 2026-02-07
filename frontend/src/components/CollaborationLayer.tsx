import type { Editor } from '@tiptap/react'
import { type CursorPresence, type PresenceUser } from './DashboardLayout.types'

type CollaborationLayerProps = {
  remoteCursors: Record<string, CursorPresence>
  presenceById: Map<string, PresenceUser>
  localUser: PresenceUser | null
  documentEditorInstancesRef: React.MutableRefObject<Map<string, Editor>>
}

// Floating collaboration cursors.
export function CollaborationLayer({
  remoteCursors,
  presenceById,
  localUser,
  documentEditorInstancesRef,
}: CollaborationLayerProps) {
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
                className="-mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow"
                style={{ backgroundColor: user.color }}
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

    const container = cursor.documentId
      ? (document.querySelector(
          `[data-doc-id="${cursor.documentId}"] .document-content`,
        ) as HTMLElement | null)
      : null
    const containerRect = container?.getBoundingClientRect()
    const left = containerRect ? containerRect.left + cursor.x : cursor.x
    const top = containerRect ? containerRect.top + cursor.y : cursor.y

    return (
      <div key={userId} className="absolute" style={{ left, top }}>
        <div className="h-5 w-0.5" style={{ backgroundColor: user.color }} />
        <div
          className="-mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow"
          style={{ backgroundColor: user.color }}
        >
          {user.name}
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {Object.entries(remoteCursors).map(([userId, cursor]) => {
        const overlay = renderCursor(userId, cursor)
        if (overlay) overlays.push(overlay)
        return null
      })}
      {overlays}
    </div>
  )
}
