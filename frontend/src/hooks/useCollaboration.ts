import { useEffect, useRef, useState } from 'react'
import { type CursorPresence, type PresenceUser } from '../components/DashboardLayout.types'
import { useProjectWebSocket } from './useProjectWebSocket.ts'

type UseCollaborationArgs = {
  onProjectUpdate: (project: Record<string, unknown>) => void
}

// WebSocket-backed presence and cursor tracking.
export function useCollaboration({ onProjectUpdate }: UseCollaborationArgs) {
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [localUser, setLocalUser] = useState<PresenceUser | null>(null)
  const [remoteCursors, setRemoteCursors] = useState<Record<string, CursorPresence>>({})
  const [hasRemoteState, setHasRemoteState] = useState(false)
  const localUserRef = useRef<PresenceUser | null>(null)

  const { isOnline: websocketOnline, sendJson } = useProjectWebSocket({
    onMessage: (payload) => {
      if (!payload || typeof payload !== 'object') return
      const data = payload as Record<string, unknown>
      const type = data.type as string | undefined

      if (type === 'hello') {
        const user = data.user as PresenceUser | undefined
        if (user) {
          setLocalUser(user)
          localUserRef.current = user
        }
        const users = data.users as PresenceUser[] | undefined
        if (users) setPresenceUsers(users)
        const projectRaw = (data.project_raw ?? data.project) as Record<string, unknown> | undefined
        if (projectRaw) {
          onProjectUpdate(projectRaw)
        }
        setHasRemoteState(true)
        return
      }

      if (type === 'presence:update') {
        const users = data.users as PresenceUser[] | undefined
        if (users) setPresenceUsers(users)
        return
      }

      if (type === 'cursor:update') {
        const userId = data.userId as string | undefined
        const cursor = data.cursor as CursorPresence | undefined
        if (!userId || !cursor) return
        setRemoteCursors((current) => ({
          ...current,
          [userId]: cursor,
        }))
        return
      }

      if (type === 'cursor:clear') {
        const userId = data.userId as string | undefined
        if (!userId) return
        setRemoteCursors((current) => {
          const next = { ...current }
          delete next[userId]
          return next
        })
        return
      }

      if (type === 'project:update') {
        const senderId = data.sender_id as string | undefined
        if (senderId && senderId === localUserRef.current?.id) return
        const projectRaw = (data.project_raw ?? data.project) as Record<string, unknown> | undefined
        if (projectRaw) {
          onProjectUpdate(projectRaw)
        }
      }
    },
  })

  useEffect(() => {
    localUserRef.current = localUser
  }, [localUser])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now()
      setRemoteCursors((current) => {
        const next: Record<string, CursorPresence> = {}
        Object.entries(current).forEach(([userId, cursor]) => {
          if (now - cursor.updatedAt < 8000) {
            next[userId] = cursor
          }
        })
        return next
      })
    }, 3000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  return {
    websocketOnline,
    sendJson,
    presenceUsers,
    localUser,
    remoteCursors,
    hasRemoteState,
  }
}
