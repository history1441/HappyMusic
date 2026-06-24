import { create } from 'zustand'
import * as FileSystem from 'expo-file-system/legacy'

const THEME_FILE = `${FileSystem.documentDirectory}theme.json`

export type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  init: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',

  setMode: (mode: ThemeMode) => {
    set({ mode })
    try {
      FileSystem.writeAsStringAsync(THEME_FILE, JSON.stringify({ mode }))
    } catch {}
  },

  init: async () => {
    try {
      const info = await FileSystem.getInfoAsync(THEME_FILE)
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(THEME_FILE)
        const data = JSON.parse(content)
        if (data.mode === 'system' || data.mode === 'light' || data.mode === 'dark') {
          set({ mode: data.mode })
        } else if (typeof data.isDark === 'boolean') {
          // 向后兼容旧格式
          set({ mode: data.isDark ? 'dark' : 'light' })
        }
      }
    } catch {}
  },
}))
