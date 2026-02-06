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

export function useProjectWebSocket(options: UseProjectWebSocketOptions = {}) {
  const [isOnline, setIsOnline] = useState(false)
  const messageHandlerRef = useRef(options.onMessage)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const pingTimerRef = useRef<number | null>(null)
  const retryCountRef = useRef(0)

  useEffect(() => {
    messageHandlerRef.current = options.onMessage
  }, [options.onMessage])

  useEffect(() => {
    const url = getWebSocketUrl()
    if (!url) return undefined
    let isDisposed = false

    const clearPing = () => {
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current)
        pingTimerRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (isDisposed) return
      if (reconnectTimerRef.current) return
      const retry = retryCountRef.current
      const delay = Math.min(10000, 500 * Math.pow(2, retry))
      console.info('[WebSocket] reconnect scheduled', { retry, delay })
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, delay)
    }

    const connect = () => {
      if (isDisposed) return
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return

      const socket = new WebSocket(url)
      socketRef.current = socket
      console.info('[WebSocket] connecting', url)

      socket.onopen = () => {
        retryCountRef.current = 0
        setIsOnline(true)
        console.info('[WebSocket] connected')
        clearPing()
        pingTimerRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
          }
        }, 25000)
      }

      socket.onclose = (event) => {
        setIsOnline(false)
        console.warn('[WebSocket] closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        })
        clearPing()
        retryCountRef.current += 1
        scheduleReconnect()
      }

      socket.onerror = () => {
        setIsOnline(false)
        console.error('[WebSocket] error')
        clearPing()
        retryCountRef.current += 1
        scheduleReconnect()
      }

      socket.onmessage = (event) => {
        console.info('[WebSocket] message', { size: event.data?.length ?? 0 })
        if (!messageHandlerRef.current) return
        try {
          const payload = JSON.parse(event.data)
          messageHandlerRef.current(payload)
        } catch {
          messageHandlerRef.current(event.data)
        }
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.info('[WebSocket] visibility change: visible')
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
          connect()
        }
      }
    }

    connect()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      isDisposed = true
      console.info('[WebSocket] disposed')
      document.removeEventListener('visibilitychange', handleVisibility)
      clearPing()
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [])

  const sendJson = useCallback((payload: unknown) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] send skipped (not open)')
      return false
    }
    try {
      socketRef.current.send(JSON.stringify(payload))
      console.info('[WebSocket] send', payload)
      return true
    } catch {
      console.error('[WebSocket] send failed')
      return false
    }
  }, [])

  return { isOnline, sendJson }
}
