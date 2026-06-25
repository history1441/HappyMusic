import { create } from 'zustand'

// 持久化 key 与 common 共享层一致(theme_mode),便于未来迁移到 common themeStore
const THEME_KEY = 'theme_mode'

interface ThemeState {
  isDark: boolean
  toggle: () => void
  init: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: false,

  toggle: () =>
    set((s) => {
      const next = !s.isDark
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
      document.documentElement.classList.toggle('dark', next)
      return { isDark: next }
    }),

  init: () => {
    const saved = localStorage.getItem(THEME_KEY)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = saved ? saved === 'dark' : prefersDark
    document.documentElement.classList.toggle('dark', isDark)
    set({ isDark })
  },
}))

