import { create } from 'zustand'
import { getAdapter } from '../adapters'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'theme_mode'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  init: () => Promise<void>
}

/**
 * 主题 Store(三端共用)
 * 持久化通过 StorageAdapter,各端实现不同(mobile: FileSystem / desktop: Tauri Store / web: localStorage)
 */
export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',

  setMode: (mode) => {
    set({ mode })
    getAdapter().storage.setItem(STORAGE_KEY, mode).catch(() => {})
  },

  init: async () => {
    try {
      const saved = await getAdapter().storage.getItem(STORAGE_KEY)
      if (saved && ['system', 'light', 'dark'].includes(saved)) {
        set({ mode: saved as ThemeMode })
      }
    } catch {}
  },
}))
