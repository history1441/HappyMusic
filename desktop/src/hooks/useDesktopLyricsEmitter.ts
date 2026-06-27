import { useEffect, useRef } from 'react'
import { emit } from '@tauri-apps/api/event'
import { usePlayerStore } from '../stores/playerStore'

/**
 * 主窗口:监听 playerStore 的歌词与播放进度,计算当前/下一句歌词,
 * 通过 Tauri 事件 'lyric-line' 广播给桌面歌词悬浮窗(独立窗口)。
 * 仅在 Tauri 环境运行;按「当前句|下一句」签名去重,避免高频 emit。
 */
export function useDesktopLyricsEmitter() {
  const lyrics = usePlayerStore(s => s.lyrics)
  const position = usePlayerStore(s => s.position)
  const lastSig = useRef('')

  useEffect(() => {
    if (!(window as any).__TAURI_INTERNALS__) return
    let current = ''
    let next = ''
    if (lyrics.length > 0) {
      let idx = -1
      for (let i = lyrics.length - 1; i >= 0; i--) {
        if (position >= lyrics[i].time) { idx = i; break }
      }
      if (idx >= 0) {
        current = lyrics[idx].text
        if (idx + 1 < lyrics.length) next = lyrics[idx + 1].text
      }
    }
    const sig = `${current}|${next}`
    if (sig !== lastSig.current) {
      lastSig.current = sig
      emit('lyric-line', { current, next, hasLyric: lyrics.length > 0 }).catch(() => {})
    }
  }, [lyrics, position])
}
