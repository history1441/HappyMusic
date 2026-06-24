import { getApiUrl } from './api'
import { getCachedAccessToken } from './api'

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let syncEnabled = false
let lastStateHash = ''

/** 计算状态哈希，用于去重 */
function stateHash(song: string, playing: boolean, progress: number, volume: number, mode: string): string {
  return `${song}|${playing}|${progress}|${volume}|${mode}`
}

export function isSyncConnected(): boolean {
  return syncEnabled
}

export function connectSync(onCommand?: (msg: any) => void) {
  const token = getCachedAccessToken()
  if (!token) return

  const protocol = typeof window !== 'undefined'
    ? (window.location.protocol === 'https:' ? 'wss:' : 'ws:')
    : 'ws:'
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:9527'
  const url = `${protocol}//${host}/ws/sync?token=${token}`

  try {
    ws = new WebSocket(url)
  } catch { return }

  ws.onopen = () => {
    syncEnabled = true
    console.log('Sync: connected')
  }

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'command' && onCommand) {
        onCommand(msg)
      } else if (msg.type === 'full_state') {
        // 接收完整状态同步
        window.dispatchEvent(new CustomEvent('sync-full-state', { detail: msg }))
      } else if (msg.type === 'player_state') {
        window.dispatchEvent(new CustomEvent('sync-player-state', { detail: msg }))
      } else if (msg.type === 'request_state') {
        // 收到其他设备请求状态，回复当前状态
        sendState()
      }
    } catch {}
  }

  ws.onclose = () => {
    syncEnabled = false
    reconnectTimer = setTimeout(connectSync, 5000)
  }

  ws.onerror = () => { ws?.close() }
}

export function sendPlayerState(state: Record<string, any>) {
  if (ws?.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({ type: 'player_state', ...state }))
    } catch {}
  }
}

export function sendState(opts?: {
  song?: any
  is_playing?: boolean
  progress?: number
  volume?: number
  play_mode?: string
}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return

  // 状态未变化则跳过
  const s = opts || {
    song: undefined,
    is_playing: undefined,
    progress: undefined,
    volume: undefined,
    play_mode: undefined,
  }
  const hash = stateHash(
    s.song ? JSON.stringify(s.song) : '',
    s.is_playing ?? false,
    s.progress ?? 0,
    s.volume ?? 0,
    s.play_mode ?? ''
  )
  if (hash === lastStateHash) return
  lastStateHash = hash

  try {
    ws.send(JSON.stringify({
      type: 'player_state',
      ...s,
      timestamp: Date.now(),
    }))
  } catch {}
}

export function sendCommand(action: string, params?: any) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  try {
    ws.send(JSON.stringify({ type: 'command', action, params }))
  } catch {}
}

export function requestStateSync() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  try {
    ws.send(JSON.stringify({ type: 'request_state' }))
  } catch {}
}

export function disconnectSync() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  ws?.close()
  ws = null
  syncEnabled = false
}
