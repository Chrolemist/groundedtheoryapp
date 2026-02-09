import { useCallback, useEffect, useRef, useState } from 'react'

const getClientId = () => {
  if (typeof window === 'undefined') return ''
  const storageKey = 'gt-client-id'
  const stored = window.sessionStorage.getItem(storageKey)
  if (stored) return stored
  const next = crypto.randomUUID()
  window.sessionStorage.setItem(storageKey, next)
  return next
}

const getWebSocketUrl = (projectId?: string | null) => {
  if (typeof window === 'undefined') return ''
  if (!projectId) return ''
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const clientId = getClientId()
  const params = new URLSearchParams()
  if (clientId) params.set('client_id', clientId)
  params.set('project_id', projectId)
  const query = params.toString() ? `?${params.toString()}` : ''
  const configuredWsBase = (import.meta.env.VITE_WS_BASE as string | undefined) ?? ''
  const configuredApiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

  if (configuredWsBase) {
    const wsUrl = new URL(configuredWsBase, window.location.origin)
    // Ensure /ws path exists on the configured base.
    const basePath = wsUrl.pathname.endsWith('/') ? wsUrl.pathname.slice(0, -1) : wsUrl.pathname
    wsUrl.pathname = `${basePath}/ws`
    wsUrl.search = query.startsWith('?') ? query : `?${query}`
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : wsUrl.protocol === 'http:' ? 'ws:' : wsUrl.protocol
    return wsUrl.toString()
  }

  if (configuredApiBase) {
    const apiUrl = new URL(configuredApiBase, window.location.origin)
    const basePath = apiUrl.pathname.endsWith('/') ? apiUrl.pathname.slice(0, -1) : apiUrl.pathname
    apiUrl.pathname = `${basePath}/ws`
    apiUrl.search = query.startsWith('?') ? query : `?${query}`
    apiUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : apiUrl.protocol === 'http:' ? 'ws:' : apiUrl.protocol
    return apiUrl.toString()
  }

  const host = window.location.port === '5173' ? 'localhost:8000' : window.location.host
  return `${protocol}://${host}/ws${query}`
}

type UseProjectWebSocketOptions = {
  onMessage?: (data: unknown) => void
  projectId?: string | null
}

type MessageHandler = (data: unknown) => void
type StatusHandler = (online: boolean) => void

let sharedSocket: WebSocket | null = null
let sharedUrl: string | null = null
const sharedHandlers = new Set<MessageHandler>()
const sharedStatusHandlers = new Set<StatusHandler>()
let sharedPingTimer: number | null = null
let sharedReconnectTimer: number | null = null
let sharedRetryCount = 0
let sharedRefCount = 0
let sharedLastHello: unknown | null = null
let sharedLastHelloUrl: string | null = null
let sharedLastYjsSync: unknown | null = null
let sharedLastYjsSyncUrl: string | null = null

const isDebugEnabled = () => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('gt-debug') === 'true'
}

const isSocketActive = (socket: WebSocket | null) => {
  if (!socket) return false
  return socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING
}

const isSocketOpen = (socket: WebSocket | null) => {
  if (!socket) return false
  return socket.readyState === WebSocket.OPEN
}

const clearSharedPing = () => {
  if (sharedPingTimer) {
    window.clearInterval(sharedPingTimer)
    sharedPingTimer = null
  }
}

const notifyStatus = (online: boolean) => {
  sharedStatusHandlers.forEach((handler) => {
    try {
      handler(online)
    } catch (error) {
      if (isDebugEnabled()) {
        console.warn('[WS] status handler error', error)
      }
    }
  })
}

const scheduleSharedReconnect = (connect: () => void) => {
  if (sharedReconnectTimer) return
  const retry = sharedRetryCount
  const delay = Math.min(10000, 500 * Math.pow(2, retry))
  
  sharedReconnectTimer = window.setTimeout(() => {
    sharedReconnectTimer = null
    connect()
  }, delay)
}

const connectSharedSocket = (url: string) => {
  if (isSocketActive(sharedSocket)) {
    // If a reconnect was scheduled with an old URL, we may have an active socket
    // pointing at the wrong project. Replace it.
    if (sharedSocket?.url !== url) {
      try {
        sharedSocket?.close()
      } catch {
        // ignore
      }
      sharedSocket = null
    } else {
      return
    }
  }

  if (isDebugEnabled()) {
    console.log('[WS] connect', url)
  }

  const socket = new WebSocket(url)
  sharedSocket = socket
  sharedLastHello = null
  sharedLastHelloUrl = null
  sharedLastYjsSync = null
  sharedLastYjsSyncUrl = null
  

  socket.onopen = () => {
    sharedRetryCount = 0
    notifyStatus(true)
    if (isDebugEnabled()) {
      console.log('[WS] open')
    }
    
    clearSharedPing()
    sharedPingTimer = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
      }
    }, 25000)
  }

  socket.onclose = () => {
    notifyStatus(false)
    if (isDebugEnabled()) {
      console.log('[WS] close')
    }
    
    clearSharedPing()
    sharedRetryCount += 1
    sharedSocket = null
    scheduleSharedReconnect(() => {
      if (!sharedUrl) return
      connectSharedSocket(sharedUrl)
    })
  }

  socket.onerror = () => {
    notifyStatus(false)
    if (isDebugEnabled()) {
      console.log('[WS] error')
    }
    
    clearSharedPing()
    sharedRetryCount += 1
    sharedSocket = null
    scheduleSharedReconnect(() => {
      if (!sharedUrl) return
      connectSharedSocket(sharedUrl)
    })
  }

  socket.onmessage = (event) => {
    
    let payload: unknown = event.data
    try {
      payload = JSON.parse(event.data)
    } catch {
      // Keep raw payload.
    }

    // Cache the hello message so late subscribers (e.g. presence layer) don't miss it.
    // This fixes cases where Yjs attaches first and drops non-yjs messages.
    if (
      payload &&
      typeof payload === 'object' &&
      (payload as Record<string, unknown>).type === 'hello'
    ) {
      sharedLastHello = payload
      sharedLastHelloUrl = url
    }

    // Cache the initial Yjs sync so late subscribers (e.g. the editor/Yjs layer)
    // don't miss it. Missing this can leave hasReceivedSync=false and block seeding,
    // especially after Close project -> reopen where the presence layer may connect first.
    if (
      payload &&
      typeof payload === 'object' &&
      (payload as Record<string, unknown>).type === 'yjs:sync'
    ) {
      sharedLastYjsSync = payload
      sharedLastYjsSyncUrl = url
    }
    sharedHandlers.forEach((handler) => {
      try {
        handler(payload)
      } catch (error) {
        if (isDebugEnabled()) {
          console.warn('[WS] message handler error', error)
        }
      }
    })
  }
}

export function useProjectWebSocket(options: UseProjectWebSocketOptions = {}) {
  const [isOnline, setIsOnline] = useState(false)
  const messageHandlerRef = useRef(options.onMessage)
  const disableWsEnv = import.meta.env.VITE_DISABLE_WS === 'true'
  const disableWsDebug =
    typeof window !== 'undefined' && window.localStorage.getItem('gt-disable-ws') === 'true'
  const disableWs = disableWsEnv || disableWsDebug
  const projectId = options.projectId ?? null

  useEffect(() => {
    messageHandlerRef.current = options.onMessage
  }, [options.onMessage])

  useEffect(() => {
    if (disableWs) return undefined
    const url = getWebSocketUrl(projectId)
    if (!url) {
      return undefined
    }
    const handleMessage = (payload: unknown) => {
      // If we are receiving any message, the connection is effectively online.
      // This also fixes a race where the socket opens before status handlers subscribe.
      setIsOnline(true)
      messageHandlerRef.current?.(payload)
    }
    const handleStatus = (online: boolean) => {
      setIsOnline(online)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        connectSharedSocket(url)
      }
    }

    sharedHandlers.add(handleMessage)
    sharedStatusHandlers.add(handleStatus)
    sharedRefCount += 1
    if (!sharedUrl) {
      sharedUrl = url
    }
    if (sharedUrl !== url) {
      sharedSocket?.close()
      sharedSocket = null
      sharedUrl = url
      sharedRetryCount = 0
      sharedLastHello = null
      sharedLastHelloUrl = null
      sharedLastYjsSync = null
      sharedLastYjsSyncUrl = null
    }
    connectSharedSocket(sharedUrl)
    // Initialize state from current socket status in case the socket is already open.
    // Defer to a microtask to avoid synchronous setState inside the effect body.
    queueMicrotask(() => {
      setIsOnline(isSocketOpen(sharedSocket))
    })

    // Replay cached hello for this URL if it was received before we subscribed.
    if (sharedLastHello && sharedLastHelloUrl === sharedUrl) {
      window.setTimeout(() => {
        handleMessage(sharedLastHello)
      }, 0)
    }

    // Replay cached Yjs sync for this URL if it was received before we subscribed.
    if (sharedLastYjsSync && sharedLastYjsSyncUrl === sharedUrl) {
      window.setTimeout(() => {
        if (isDebugEnabled()) {
          console.log('[WS] replay yjs:sync')
        }
        handleMessage(sharedLastYjsSync)
      }, 0)
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      
      document.removeEventListener('visibilitychange', handleVisibility)
      sharedHandlers.delete(handleMessage)
      sharedStatusHandlers.delete(handleStatus)
      sharedRefCount = Math.max(0, sharedRefCount - 1)
      if (sharedRefCount === 0) {
        clearSharedPing()
        if (sharedReconnectTimer) {
          window.clearTimeout(sharedReconnectTimer)
          sharedReconnectTimer = null
        }
        sharedSocket?.close()
        sharedSocket = null
        sharedUrl = null
        sharedRetryCount = 0
        sharedLastHello = null
        sharedLastHelloUrl = null
        sharedLastYjsSync = null
        sharedLastYjsSyncUrl = null
      }
    }
  }, [disableWs, projectId])

  const sendJson = useCallback((payload: unknown) => {
    if (disableWs) return false
    if (!projectId) return false
    if (!sharedSocket || sharedSocket.readyState !== WebSocket.OPEN) return false
    try {
      sharedSocket.send(JSON.stringify(payload))
      return true
    } catch {
      return false
    }
  }, [disableWs, projectId])

  const effectiveOnline = !disableWs && Boolean(projectId) && isOnline
  return { isOnline: effectiveOnline, sendJson }
}
