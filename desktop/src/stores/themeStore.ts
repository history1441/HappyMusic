import { create } from 'zustand'
import { load, type Store } from '@tauri-apps/plugin-store'

const STORE_KEY = 'theme_settings'

let _store: Store | null = null

async function getStore(): Promise<Store> {
  if (!_store) {
    _store = await load('app-store.json', { autoSave: false } as any)
  }
  return _store
}

function prefersDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

interface ThemeState {
  isDark: boolean
  toggle: () => void
  init: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: false,

  toggle: async () => {
    const newVal = !get().isDark
    set({ isDark: newVal })
    try {
      const store = await getStore()
      await store.set(STORE_KEY, { isDark: newVal })
      await store.save()
    } catch {}
  },

  init: async () => {
    try {
      const store = await getStore()
      const data = await store.get<{ isDark: boolean }>(STORE_KEY)
      if (data && typeof data.isDark === 'boolean') {
        set({ isDark: data.isDark })
      } else {
        // No saved preference — detect system preference
        set({ isDark: prefersDarkMode() })
      }
    } catch {
      // Fallback to system preference
      set({ isDark: prefersDarkMode() })
    }
  },
}))
