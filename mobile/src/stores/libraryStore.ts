import { create } from 'zustand'
import { getAllDownloads, getAllCache } from '../services/cacheService'
import type { LocalSong } from '../types'

interface LibraryState {
  downloads: LocalSong[]
  cache: LocalSong[]
  loading: boolean
  loadLibrary: () => Promise<void>
}

export const useLibraryStore = create<LibraryState>((set) => ({
  downloads: [],
  cache: [],
  loading: false,

  loadLibrary: async () => {
    set({ loading: true })
    try {
      const [downloads, cache] = await Promise.all([getAllDownloads(), getAllCache()])
      set({ downloads, cache, loading: false })
    } catch {
      set({ loading: false })
    }
  },
}))
