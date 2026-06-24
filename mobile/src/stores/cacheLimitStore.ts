import { create } from 'zustand'
import * as FileSystem from 'expo-file-system/legacy'

const FILE = `${FileSystem.documentDirectory}cache_limit.json`

export const CACHE_LIMIT_OPTIONS = [
  { label: '500 MB', value: 500 },
  { label: '1 GB', value: 1000 },
  { label: '2 GB', value: 2000 },
  { label: '5 GB', value: 5000 },
  { label: '不限制', value: 0 },
]

interface CacheLimitState {
  maxMB: number // 0 = unlimited
  setLimit: (mb: number) => void
  init: () => Promise<void>
}

export const useCacheLimitStore = create<CacheLimitState>((set) => ({
  maxMB: 2000,

  setLimit: (mb: number) => {
    set({ maxMB: mb })
    try {
      FileSystem.writeAsStringAsync(FILE, JSON.stringify({ maxMB: mb }))
    } catch {}
  },

  init: async () => {
    try {
      const info = await FileSystem.getInfoAsync(FILE)
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(FILE)
        const data = JSON.parse(content)
        if (typeof data.maxMB === 'number') {
          set({ maxMB: data.maxMB })
        }
      }
    } catch {}
  },
}))
