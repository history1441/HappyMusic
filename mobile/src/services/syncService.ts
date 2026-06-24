import { getApiUrl } from './api'
import { getCachedAccessToken } from './api'

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0
const MAX_RECONNECT_DELAY = 60000
// 保存 onCommand 回调,重连时复用(否则重连后命令路由丢失)
let savedOnCommand: ((msg: any) => void) | undefined

export function connectSync(onCommand?: (msg: any) => void) {
  const token = getCachedAccessToken()
  if (!token) return

  if (onCommand) savedOnCommand = onCommand

  const url = `${getApiUrl().replace(/^http/, 'ws')}/ws/sync?token=${token}`
  try {
    ws = new WebSocket(url)
  } catch { return }

  ws.onopen = () => {
    reconnectAttempt = 0
    console.log('Sync: connected')
  }
  ws.onmessage = (e) => {
    let msg: any
    try {
      msg = JSON.parse(e.data)
    } catch (err) {
      console.warn('Sync: invalid message (JSON parse failed)', err)
      return
    }
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
      console.warn('Sync: invalid message structure', e.data)
      return
    }
    if (msg.type === 'command') {
      if (typeof msg.action !== 'string') {
        console.warn('Sync: command message missing action field', msg)
        return
      }
      const handler = savedOnCommand
      if (handler) {
        handler(msg)
      } else {
        handleRemoteCommand(msg.action)
      }
    }
  }
  ws.onclose = () => {
    ws = null
    reconnectAttempt++
    const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY)
    console.log(`Sync: disconnected, reconnect in ${delay}ms (attempt ${reconnectAttempt})`)
    reconnectTimer = setTimeout(() => connectSync(), delay)
  }
  ws.onerror = () => { ws?.close() }
}

function handleRemoteCommand(action: string) {
  try {
    const { usePlayerStore } = require('../stores/playerStore')
    const store = usePlayerStore.getState()
    switch (action) {
      case 'play':
      case 'resume':
        store.resume()
        break
      case 'pause':
        store.pause()
        break
      case 'next':
        store.next()
        break
      case 'prev':
        store.prev()
        break
      case 'toggle':
        store.togglePlay()
        break
      case 'volume':
        break
    }
  } catch (e) {
    console.warn('Sync command error:', e)
  }
}

export function sendPlayerState(state: Record<string, any>) {
  if (ws?.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({ type: 'player_state', ...state }))
    } catch {}
  }
}

export function disconnectSync() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectAttempt = 0
  savedOnCommand = undefined
  ws?.close()
  ws = null
}
