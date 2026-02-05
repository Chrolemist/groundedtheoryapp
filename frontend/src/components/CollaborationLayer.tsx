import { DragOverlay } from '@dnd-kit/core'
import { Tag } from 'lucide-react'
import { cn } from '../lib/cn'
import { type Code } from '../types'
import { type CursorPresence, type PresenceUser } from './DashboardLayout.types'

type CollaborationLayerProps = {
  remoteCursors: Record<string, CursorPresence>
  presenceById: Map<string, PresenceUser>
  localUser: PresenceUser | null
  activeCode: Code | null
}

// Floating collaboration cursors and drag preview.
export function CollaborationLayer({
  remoteCursors,
  presenceById,
  localUser,
  activeCode,
}: CollaborationLayerProps) {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-50">
        {Object.entries(remoteCursors).map(([userId, cursor]) => {
          if (localUser?.id === userId) return null
          const user = presenceById.get(userId)
          if (!user) return null
          return (
            <div key={userId} className="absolute" style={{ left: cursor.x, top: cursor.y }}>
              <div className="h-5 w-0.5" style={{ backgroundColor: user.color }} />
              <div
                className="-mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow"
                style={{ backgroundColor: user.color }}
              >
                {user.name}
              </div>
            </div>
          )
        })}
      </div>

      <DragOverlay>
        {activeCode ? (
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset shadow-sm',
              activeCode.colorClass,
            )}
            style={{
              backgroundColor: activeCode.colorHex ?? undefined,
              color: activeCode.textHex ?? undefined,
              boxShadow: activeCode.ringHex
                ? `inset 0 0 0 1px ${activeCode.ringHex}`
                : undefined,
            }}
          >
            <Tag className="h-3 w-3" />
            {activeCode.label}
          </span>
        ) : null}
      </DragOverlay>
    </>
  )
}
