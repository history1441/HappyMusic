import { useEffect, useRef, useState, useCallback } from 'react'
import { getCachedAccessToken } from '../services/api'
import { getApiUrl } from '../utils/constants'
import { usePlayerStore } from '../stores/playerStore'

interface SyncState {
  sendState: (state: any) => void
  isConnected: boolean
}

export function useSync(): SyncState {
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return

    const token = getCachedAccessToken()
    if (!token) {
      scheduleReconnect()
      return
    }

    const wsUrl = `${getApiUrl().replace(/^http/, 'ws')}/api/ws/sync?token=${token}`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (mountedRef.current) {
          setIsConnected(true)
        }
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
        try {
          const message = JSON.parse(event.data)
          handleMessage(message)
        } catch {}
      }

      ws.onclose = () => {
        if (mountedRef.current) {
          setIsConnected(false)
        }
        wsRef.current = null
        scheduleReconnect()
      }

      ws.onerror = () => {}
    } catch {
      scheduleReconnect()
    }
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    reconnectTimer.current = setTimeout(() => {
      if (mountedRef.current) {
        connect()
      }
    }, 5000)
  }, [connect])

  const handleMessage = useCallback((message: any) => {
    const { type, data } = message

    switch (type) {
      case 'player_state': {
        break
      }
      case 'command': {
        const playerStore = usePlayerStore.getState()
        switch (data?.command) {
          case 'play':
            playerStore.togglePlay()
            break
          case 'pause':
            playerStore.togglePlay()
            break
          case 'next':
            playerStore.next()
            break
          case 'prev':
            playerStore.prev()
            break
        }
        break
      }
      case 'request_state': {
        const playerStore = usePlayerStore.getState()
        const state = {
          type: 'player_state',
          data: {
            currentSong: playerStore.currentSong,
            isPlaying: playerStore.isPlaying,
            position: playerStore.position,
            duration: playerStore.duration,
            playMode: playerStore.playMode,
            queue: playerStore.queue,
            queueIndex: playerStore.queueIndex,
          },
        }
        sendState(state)
        break
      }
    }
  }, [])

  const sendState = useCallback((state: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(state))
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return { sendState, isConnected }
}
