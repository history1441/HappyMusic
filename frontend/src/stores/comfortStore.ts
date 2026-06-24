import { create } from 'zustand'

const STORAGE_KEY = 'comfort_settings'

interface ComfortState {
  enabled: boolean
  songsSinceLast: number
  setEnabled: (v: boolean) => void
  recordSongPlayed: () => boolean // returns true if should trigger
  resetCounter: () => void
  init: () => void
}

function save(state: { enabled: boolean; songsSinceLast: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function load(): { enabled?: boolean; songsSinceLast?: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export const useComfortStore = create<ComfortState>((set, get) => ({
  enabled: true,
  songsSinceLast: 0,

  setEnabled: (v: boolean) => {
    set({ enabled: v })
    save(get())
  },

  recordSongPlayed: () => {
    const state = get()
    if (!state.enabled) return false
    const next = state.songsSinceLast + 1
    set({ songsSinceLast: next })
    save(get())
    // 前9首10%概率触发，第10首保底
    if (next >= 10) return true
    return Math.random() < 0.1
  },

  resetCounter: () => {
    set({ songsSinceLast: 0 })
    save(get())
  },

  init: () => {
    const data = load()
    if (typeof data.enabled === 'boolean') set({ enabled: data.enabled })
    if (typeof data.songsSinceLast === 'number') set({ songsSinceLast: data.songsSinceLast })
  },
}))
