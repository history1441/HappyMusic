import { useState, useEffect } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

interface LyricPayload {
  current: string
  next: string
  hasLyric: boolean
}

/**
 * 桌面歌词悬浮窗内容(独立 Tauri 窗口 desktop-lyrics)。
 * 监听主窗口 emit 的 'lyric-line' 事件,实时显示当前/下一句歌词。
 * 透明背景 + 文字描边,始终置顶(窗口配置见 tauri.conf.json)。
 */
export default function DesktopLyricsWindow() {
  const [data, setData] = useState<LyricPayload>({ current: '', next: '', hasLyric: false })

  useEffect(() => {
    let unlisten: UnlistenFn | undefined
    listen<LyricPayload>('lyric-line', (e) => {
      setData(e.payload)
    }).then((fn) => { unlisten = fn })

    // 双击关闭悬浮窗(隐藏)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') getCurrentWindow().hide()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      unlisten?.()
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div
      data-tauri-drag-region
      style={{
        width: '100vw', height: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        cursor: 'move', gap: 2, userSelect: 'none',
      }}
      onDoubleClick={() => getCurrentWindow().hide()}
    >
      <div style={{
        fontSize: 26, fontWeight: 700,
        color: data.current ? '#fff' : 'rgba(255,255,255,0.5)',
        textShadow: '0 0 4px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,1)',
        WebkitTextStroke: '0.5px rgba(0,0,0,0.6)',
        maxWidth: '95vw', textAlign: 'center',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        lineHeight: 1.2,
      }}>
        {data.hasLyric ? (data.current || '♪') : 'HappyMusic 桌面歌词'}
      </div>
      {data.next && (
        <div style={{
          fontSize: 15, fontWeight: 400,
          color: 'rgba(255,255,255,0.7)',
          textShadow: '0 0 3px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.7)',
          maxWidth: '90vw', textAlign: 'center',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {data.next}
        </div>
      )}
    </div>
  )
}
