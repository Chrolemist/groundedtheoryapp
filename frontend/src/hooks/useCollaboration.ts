import { useCallback, useEffect, useRef, useState } from 'react'
import { type CursorPresence, type PresenceUser } from '../components/DashboardLayout.types'
import { useProjectWebSocket } from './useProjectWebSocket.ts'

type UseCollaborationArgs = {
  onProjectUpdate: (project: Record<string, unknown>) => void
}

const hexToRgb = (value: string) => {
  const hex = value.replace('#', '')
  if (hex.length !== 6) return null
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  if ([r, g, b].some((v) => Number.isNaN(v))) return null
  return { r, g, b }
}

const rgbToHsl = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255
  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === rNorm) h = ((gNorm - bNorm) / delta) % 6
    else if (max === gNorm) h = (bNorm - rNorm) / delta + 2
    else h = (rNorm - gNorm) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  return { h, s, l }
}

const colorDistance = (a: string, b: string) => {
  const rgbA = hexToRgb(a)
  const rgbB = hexToRgb(b)
  if (!rgbA || !rgbB) return 0
  const hslA = rgbToHsl(rgbA)
  const hslB = rgbToHsl(rgbB)
  const dh = Math.min(Math.abs(hslA.h - hslB.h), 360 - Math.abs(hslA.h - hslB.h)) / 180
  const ds = Math.abs(hslA.s - hslB.s)
  const dl = Math.abs(hslA.l - hslB.l)
  return Math.sqrt(dh * dh + ds * ds + dl * dl)
}

const pickDistinctColor = (palette: string[], used: Set<string>, fallbackIndex: number) => {
  if (palette.length === 0) return '#7C3AED'
  if (used.size === 0) return palette[fallbackIndex % palette.length]
  let bestColor = palette[fallbackIndex % palette.length]
  let bestScore = -1
  palette.forEach((color, index) => {
    if (used.has(color)) return
    let minDistance = Infinity
    used.forEach((usedColor) => {
      const distance = colorDistance(color, usedColor)
      if (distance < minDistance) minDistance = distance
    })
    if (minDistance > bestScore) {
      bestScore = minDistance
      bestColor = color
      return
    }
    if (minDistance === bestScore && index === fallbackIndex) {
      bestColor = color
    }
  })
  return bestScore < 0 ? palette[fallbackIndex % palette.length] : bestColor
}

// WebSocket-backed presence and cursor tracking.
export function useCollaboration({ onProjectUpdate }: UseCollaborationArgs) {
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [localUser, setLocalUser] = useState<PresenceUser | null>(null)
  const [remoteCursors, setRemoteCursors] = useState<Record<string, CursorPresence>>({})
  const [hasRemoteState, setHasRemoteState] = useState(false)
  const localUserRef = useRef<PresenceUser | null>(null)
  const broadcastRef = useRef<BroadcastChannel | null>(null)
  const disableWs = import.meta.env.VITE_DISABLE_WS === 'true'
  const presenceTimerRef = useRef<number | null>(null)
  const presenceKeyPrefix = 'gt-presence:'
  const colorKeyPrefix = 'gt-tab-color:'
  const colorKeyRef = useRef<string | null>(null)

  const getLocalIdentity = () => {
    if (typeof window === 'undefined') {
      return { id: 'local', name: 'Local', color: '#7C3AED' }
    }
    const tabIdKey = 'gt-tab-id'
    const deviceIdKey = 'gt-device-id'
    const nameKey = 'gt-client-name'
    const storedTabId = window.sessionStorage.getItem(tabIdKey)
    const storedDeviceId = window.localStorage.getItem(deviceIdKey)
    const storedName = window.localStorage.getItem(nameKey)
    const tabId = disableWs ? crypto.randomUUID() : storedTabId ?? crypto.randomUUID()
    const deviceId = storedDeviceId ?? crypto.randomUUID()
    const id = `tab-${deviceId}-${tabId}`
    const colorKey = `${colorKeyPrefix}${tabId}`
    const storedColor = window.localStorage.getItem(colorKey)
    const name = storedName ?? 'Local'
    const palette = ['#E11D48', '#2563EB', '#F97316', '#7C3AED', '#0EA5E9', '#F59E0B', '#10B981', '#DB2777']
    const usedColors = new Set<string>()
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith(colorKeyPrefix)) continue
        const value = localStorage.getItem(key)
        if (value) usedColors.add(value)
      }
    } catch {
      // Ignore storage access issues.
    }
    const hash = Array.from(tabId).reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const preferredIndex = hash % palette.length
    const color = storedColor ?? pickDistinctColor(palette, usedColors, preferredIndex)
    window.sessionStorage.setItem(tabIdKey, tabId)
    window.localStorage.setItem(deviceIdKey, deviceId)
    window.localStorage.setItem(nameKey, name)
    window.localStorage.setItem(colorKey, color)
    colorKeyRef.current = colorKey
    return { id, name, color }
  }

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

  const sendJsonLocal = useCallback(
    (payload: Record<string, unknown>) => {
      if (!disableWs) return sendJson(payload)
      const channel = broadcastRef.current
      if (!channel) return false
      const userId = localUserRef.current?.id
      const type = payload.type as string | undefined
      if (type === 'presence:rename') {
        const name = typeof payload.name === 'string' ? payload.name : ''
        if (name && localUserRef.current) {
          const nextUser = { ...localUserRef.current, name }
          localUserRef.current = nextUser
          setLocalUser(nextUser)
          setPresenceUsers((current) =>
            current.map((user) => (user.id === nextUser.id ? nextUser : user)),
          )
        }
      }
      const enriched =
        type === 'cursor:update' || type === 'cursor:clear' || type === 'presence:rename'
          ? { ...payload, userId }
          : payload
      channel.postMessage(enriched)
      return true
    },
    [disableWs, sendJson],
  )

  useEffect(() => {
    if (!localUserRef.current && localUser) {
      localUserRef.current = localUser
    }
  }, [localUser])

  useEffect(() => {
    if (!disableWs) return undefined
    const channel = new BroadcastChannel('gt-presence')
    broadcastRef.current = channel
    const self = localUserRef.current ?? getLocalIdentity()
    localUserRef.current = self
    setTimeout(() => {
      setLocalUser((current) => current ?? self)
      setPresenceUsers((current) =>
        current.some((user) => user.id === self.id) ? current : [self, ...current],
      )
    }, 0)
    channel.postMessage({ type: 'presence:hello', user: self })
    const presenceKey = `${presenceKeyPrefix}${self.id}`

    const publishPresence = () => {
      try {
        localStorage.setItem(
          presenceKey,
          JSON.stringify({
            user: self,
            updatedAt: Date.now(),
          }),
        )
      } catch {
        // Ignore storage failures in private mode.
      }
    }

    publishPresence()
    presenceTimerRef.current = window.setInterval(publishPresence, 2000)

    const hydratePresenceFromStorage = () => {
      const now = Date.now()
      const users: PresenceUser[] = []
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith(presenceKeyPrefix)) continue
        const raw = localStorage.getItem(key)
        if (!raw) continue
        try {
          const payload = JSON.parse(raw) as { user?: PresenceUser; updatedAt?: number }
          if (!payload.user || !payload.updatedAt) continue
          if (now - payload.updatedAt > 8000) continue
          users.push(payload.user)
        } catch {
          continue
        }
      }
      const map = new Map<string, PresenceUser>()
      if (localUserRef.current) {
        map.set(localUserRef.current.id, localUserRef.current)
      }
      users.forEach((user) => map.set(user.id, user))
      setPresenceUsers(Array.from(map.values()))
    }

    hydratePresenceFromStorage()
    const presenceSweep = window.setInterval(hydratePresenceFromStorage, 3000)

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown>
      const type = data.type as string | undefined
      const senderId = data.userId as string | undefined
      if (senderId && senderId === localUserRef.current?.id) return

      if (type === 'presence:hello') {
        const user = data.user as PresenceUser | undefined
        if (!user) return
        setPresenceUsers((current) => {
          if (current.some((item) => item.id === user.id)) return current
          return [...current, user]
        })
        // Reply with our own presence so the new tab sees us too.
        if (localUserRef.current && broadcastRef.current) {
          broadcastRef.current.postMessage({
            type: 'presence:hello',
            user: localUserRef.current,
          })
        }
        return
      }

      if (type === 'presence:rename') {
        const name = typeof data.name === 'string' ? data.name : ''
        const userId = data.userId as string | undefined
        if (!userId || !name) return
        setPresenceUsers((current) =>
          current.map((user) => (user.id === userId ? { ...user, name } : user)),
        )
        return
      }

      if (type === 'presence:goodbye') {
        const userId = data.userId as string | undefined
        if (!userId) return
        setPresenceUsers((current) => current.filter((user) => user.id !== userId))
        return
      }

      if (type === 'cursor:update') {
        const userId = data.userId as string | undefined
        const cursor = data.cursor as CursorPresence | undefined
        if (!userId || !cursor) return
        setRemoteCursors((current) => ({ ...current, [userId]: cursor }))
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
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || !event.key.startsWith(presenceKeyPrefix)) return
      if (!event.newValue) {
        const userId = event.key.replace(presenceKeyPrefix, '')
        setPresenceUsers((current) => current.filter((user) => user.id !== userId))
        return
      }
      try {
        const payload = JSON.parse(event.newValue) as {
          user?: PresenceUser
          updatedAt?: number
        }
        if (!payload.user) return
        setPresenceUsers((current) => {
          if (current.some((user) => user.id === payload.user?.id)) return current
          return payload.user ? [...current, payload.user] : current
        })
      } catch {
        return
      }
    }

    window.addEventListener('storage', handleStorage)

    channel.addEventListener('message', handleMessage)

    return () => {
      channel.postMessage({ type: 'presence:goodbye', userId: self.id })
      channel.removeEventListener('message', handleMessage)
      channel.close()
      broadcastRef.current = null
      window.removeEventListener('storage', handleStorage)
      if (presenceTimerRef.current) {
        window.clearInterval(presenceTimerRef.current)
        presenceTimerRef.current = null
      }
      window.clearInterval(presenceSweep)
      try {
        localStorage.removeItem(presenceKey)
      } catch {
        // Ignore storage cleanup failures.
      }
      if (colorKeyRef.current) {
        try {
          localStorage.removeItem(colorKeyRef.current)
        } catch {
          // Ignore storage cleanup failures.
        }
      }
    }
  }, [disableWs])

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
    websocketOnline: disableWs ? false : websocketOnline,
    sendJson: sendJsonLocal,
    presenceUsers,
    localUser,
    remoteCursors,
    hasRemoteState,
  }
}
