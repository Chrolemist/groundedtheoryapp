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

const getWebSocketUrl = () => {
  if (typeof window === 'undefined') return ''
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const clientId = getClientId()
  const query = clientId ? `?client_id=${encodeURIComponent(clientId)}` : ''
  const host = window.location.port === '5173' ? 'localhost:8000' : window.location.host
  return `${protocol}://${host}/ws${query}`
}

type UseProjectWebSocketOptions = {
  onMessage?: (data: unknown) => void
}

type MessageHandler = (data: unknown) => void
type StatusHandler = (online: boolean) => void

let sharedSocket: WebSocket | null = null
let sharedUrl: string | null = null
let sharedHandlers = new Set<MessageHandler>()
let sharedStatusHandlers = new Set<StatusHandler>()
let sharedPingTimer: number | null = null
let sharedReconnectTimer: number | null = null
let sharedRetryCount = 0
let sharedRefCount = 0

const isSocketActive = (socket: WebSocket | null) => {
  if (!socket) return false
  return socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING
}

const clearSharedPing = () => {
  if (sharedPingTimer) {
    window.clearInterval(sharedPingTimer)
    sharedPingTimer = null
  }
}

const notifyStatus = (online: boolean) => {
  sharedStatusHandlers.forEach((handler) => handler(online))
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
  if (isSocketActive(sharedSocket)) return

  const socket = new WebSocket(url)
  sharedSocket = socket
  

  socket.onopen = () => {
    sharedRetryCount = 0
    notifyStatus(true)
    
    clearSharedPing()
    sharedPingTimer = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
      }
    }, 25000)
  }

  socket.onclose = () => {
    notifyStatus(false)
    
    clearSharedPing()
    sharedRetryCount += 1
    sharedSocket = null
    scheduleSharedReconnect(() => connectSharedSocket(url))
  }

  socket.onerror = () => {
    notifyStatus(false)
    
    clearSharedPing()
    sharedRetryCount += 1
    sharedSocket = null
    scheduleSharedReconnect(() => connectSharedSocket(url))
  }

  socket.onmessage = (event) => {
    
    let payload: unknown = event.data
    try {
      payload = JSON.parse(event.data)
    } catch {
      // Keep raw payload.
    }
    sharedHandlers.forEach((handler) => handler(payload))
  }
}

export function useProjectWebSocket(options: UseProjectWebSocketOptions = {}) {
  const [isOnline, setIsOnline] = useState(false)
  const messageHandlerRef = useRef(options.onMessage)

  useEffect(() => {
    messageHandlerRef.current = options.onMessage
  }, [options.onMessage])

  useEffect(() => {
    const url = getWebSocketUrl()
    if (!url) return undefined
    const handleMessage = (payload: unknown) => {
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
      sharedUrl = url
    }
    connectSharedSocket(sharedUrl)
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
      }
    }
  }, [])

  const sendJson = useCallback((payload: unknown) => {
    if (!sharedSocket || sharedSocket.readyState !== WebSocket.OPEN) return false
    try {
      sharedSocket.send(JSON.stringify(payload))
      return true
    } catch {
      return false
    }
  }, [])

  return { isOnline, sendJson }
}
