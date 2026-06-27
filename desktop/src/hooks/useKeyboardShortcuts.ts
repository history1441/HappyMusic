import { useEffect } from 'react'
import { usePlayerStore } from '../stores/playerStore'

/**
 * 应用内键盘快捷键(窗口聚焦时生效):
 *  - Space:        播放 / 暂停
 *  - Ctrl/⌘ + →:   下一首
 *  - Ctrl/⌘ + ←:   上一首
 *  - Ctrl/⌘ + ↑/↓: 音量 +/- (10%)
 * 输入框聚焦时不拦截,避免影响打字。
 * 注:OS 媒体键 / 耳机按钮由 mediaSession.ts 通过 Media Session API 处理。
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      const store = usePlayerStore.getState()
      if (!store.currentSong) return
      const ctrl = e.ctrlKey || e.metaKey

      if (e.code === 'Space' && !ctrl) {
        e.preventDefault()
        store.togglePlay()
      } else if (ctrl && e.code === 'ArrowRight') {
        e.preventDefault()
        store.next()
      } else if (ctrl && e.code === 'ArrowLeft') {
        e.preventDefault()
        store.prev()
      } else if (ctrl && e.code === 'ArrowUp') {
        e.preventDefault()
        store.setVolume(Math.min(1, (store.volume ?? 1) + 0.1))
      } else if (ctrl && e.code === 'ArrowDown') {
        e.preventDefault()
        store.setVolume(Math.max(0, (store.volume ?? 1) - 0.1))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
