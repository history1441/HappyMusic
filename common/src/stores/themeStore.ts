import { create } from 'zustand'
import { getAdapter } from '../adapters'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'theme_mode'
const ACCENT_KEY = 'accent_color'

/** 内置强调色预设 */
export const ACCENT_PRESETS = [
  { id: 'red', label: '经典红', color: '#EC4141' },
  { id: 'blue', label: '海洋蓝', color: '#2563EB' },
  { id: 'purple', label: '魅惑紫', color: '#7C3AED' },
  { id: 'green', label: '清新绿', color: '#16A34A' },
  { id: 'orange', label: '活力橙', color: '#EA580C' },
  { id: 'pink', label: '樱花粉', color: '#DB2777' },
  { id: 'cyan', label: '青碧', color: '#0891B2' },
] as const

export const DEFAULT_ACCENT = '#EC4141'

/** 由强调色派生 hover(略深)/light(透明)变体,供 CSS 变量使用 */
export function deriveAccentVariants(hex: string): { hover: string; light: string } {
  const m = hex.replace('#', '').match(/.{2}/g)
  if (!m || m.length < 3) return { hover: hex, light: `${hex}1A` }
  const [r, g, b] = m.map((x) => parseInt(x, 16))
  const darken = (c: number) => Math.max(0, Math.round(c * 0.85))
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return {
    hover: `#${toHex(darken(r))}${toHex(darken(g))}${toHex(darken(b))}`,
    light: `#${toHex(r)}${toHex(g)}${toHex(b)}1A`,
  }
}

interface ThemeState {
  mode: ThemeMode
  accentColor: string
  setMode: (mode: ThemeMode) => void
  setAccentColor: (color: string) => void
  init: () => Promise<void>
}

/**
 * 主题 Store(三端共用)
 * 持久化通过 StorageAdapter,各端实现不同(mobile: FileSystem / desktop: Tauri Store / web: localStorage)
 */
export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  accentColor: DEFAULT_ACCENT,

  setMode: (mode) => {
    set({ mode })
    getAdapter().storage.setItem(STORAGE_KEY, mode).catch(() => {})
  },

  setAccentColor: (color) => {
    set({ accentColor: color })
    getAdapter().storage.setItem(ACCENT_KEY, color).catch(() => {})
  },

  init: async () => {
    try {
      const saved = await getAdapter().storage.getItem(STORAGE_KEY)
      if (saved && ['system', 'light', 'dark'].includes(saved)) {
        set({ mode: saved as ThemeMode })
      }
      const accent = await getAdapter().storage.getItem(ACCENT_KEY)
      if (accent && /^#[0-9a-fA-F]{6}$/.test(accent)) {
        set({ accentColor: accent })
      }
    } catch {}
  },
}))

