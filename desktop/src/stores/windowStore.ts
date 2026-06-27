import { create } from 'zustand'

/**
 * 桌面端窗口控制:始终置顶 + 迷你播放器模式。
 * 通过 Tauri 核心 window API(@tauri-apps/api/window)实现,
 * 无需 Rust 命令或额外插件权限(core:window 权限已含)。
 * 在非 Tauri 环境(浏览器开发)下静默降级。
 */

const NORMAL_W = 1200
const NORMAL_H = 800
const MINI_W = 420
const MINI_H = 96

async function getWindow(): Promise<any | null> {
  try {
    if (!(window as any).__TAURI_INTERNALS__) return null
    const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window')
    return { win: getCurrentWindow(), LogicalSize }
  } catch {
    return null
  }
}

interface WindowState {
  miniMode: boolean
  alwaysOnTop: boolean
  toggleAlwaysOnTop: () => Promise<void>
  enterMini: () => Promise<void>
  exitMini: () => Promise<void>
}

export const useWindowStore = create<WindowState>((set, get) => ({
  miniMode: false,
  alwaysOnTop: false,

  toggleAlwaysOnTop: async () => {
    const next = !get().alwaysOnTop
    set({ alwaysOnTop: next })
    const handle = await getWindow()
    if (handle) {
      try { await handle.win.setAlwaysOnTop(next) } catch {}
    }
  },

  enterMini: async () => {
    set({ miniMode: true, alwaysOnTop: true })
    const handle = await getWindow()
    if (handle) {
      try {
        await handle.win.setAlwaysOnTop(true)
        await handle.win.setDecorations(false)
        await handle.win.setSkipTaskbar(true)
        await handle.win.setSize(new handle.LogicalSize(MINI_W, MINI_H))
      } catch {}
    }
  },

  exitMini: async () => {
    set({ miniMode: false, alwaysOnTop: false })
    const handle = await getWindow()
    if (handle) {
      try {
        await handle.win.setAlwaysOnTop(false)
        await handle.win.setDecorations(true)
        await handle.win.setSkipTaskbar(false)
        await handle.win.setSize(new handle.LogicalSize(NORMAL_W, NORMAL_H))
        await handle.win.setFocus()
      } catch {}
    }
  },
}))
