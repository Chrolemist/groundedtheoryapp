import { type CursorPresence, type PresenceUser } from './DashboardLayout.types'

type CollaborationLayerProps = {
  remoteCursors: Record<string, CursorPresence>
  presenceById: Map<string, PresenceUser>
  localUser: PresenceUser | null
}

// Floating collaboration cursors.
export function CollaborationLayer({
  remoteCursors,
  presenceById,
  localUser,
}: CollaborationLayerProps) {
  return (
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
  )
}
