import { useCallback, useEffect, useRef, useState } from 'react'

const getWebSocketUrl = () => {
  if (typeof window === 'undefined') return ''
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws`
}

type UseProjectWebSocketOptions = {
  onMessage?: (data: unknown) => void
}

export function useProjectWebSocket(options: UseProjectWebSocketOptions = {}) {
  const [isOnline, setIsOnline] = useState(false)
  const messageHandlerRef = useRef(options.onMessage)
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    messageHandlerRef.current = options.onMessage
  }, [options.onMessage])

  useEffect(() => {
    const url = getWebSocketUrl()
    if (!url) return undefined

    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onopen = () => setIsOnline(true)
    socket.onclose = () => setIsOnline(false)
    socket.onerror = () => setIsOnline(false)
    socket.onmessage = (event) => {
      if (!messageHandlerRef.current) return
      try {
        const payload = JSON.parse(event.data)
        messageHandlerRef.current(payload)
      } catch {
        messageHandlerRef.current(event.data)
      }
    }

    return () => {
      socket.close()
    }
  }, [])

  const sendJson = useCallback((payload: unknown) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return false
    try {
      socketRef.current.send(JSON.stringify(payload))
      return true
    } catch {
      return false
    }
  }, [])

  return { isOnline, sendJson }
}
