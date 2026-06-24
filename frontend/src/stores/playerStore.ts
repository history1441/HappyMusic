import { create } from 'zustand'
import type { Song, PlayMode } from '../types'

interface PlayerState {
  currentSong: Song | null
  queue: Song[]
  queueIndex: number
  isPlaying: boolean
  volume: number
  playMode: PlayMode
  showFullPlayer: boolean
  timerMinutes: number | null
  timerEndTime: number | null

  play: (song: Song, list?: Song[]) => void
  togglePlay: () => void
  pause: () => void
  resume: () => void
  next: () => void
  prev: () => void
  setVolume: (v: number) => void
  setPlayMode: (m: PlayMode) => void
  setShowFullPlayer: (show: boolean) => void
  addToQueue: (song: Song) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  setTimer: (minutes: number | null) => void
  checkTimer: () => boolean
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  volume: parseFloat(localStorage.getItem('volume') || '0.8'),
  playMode: (localStorage.getItem('playMode') as PlayMode) || 'sequence',
  showFullPlayer: false,
  timerMinutes: null,
  timerEndTime: null,

  play: (song, list) => {
    if (list) {
      const idx = list.findIndex(
        (s) => s.song_identifier === song.song_identifier && s.source === song.source
      )
      set({
        currentSong: song,
        queue: list,
        queueIndex: idx >= 0 ? idx : 0,
        isPlaying: true,
      })
    } else {
      set({
        currentSong: song,
        queue: [song],
        queueIndex: 0,
        isPlaying: true,
      })
    }
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),

  next: () => {
    const { queue, queueIndex, playMode } = get()
    if (queue.length === 0) return
    let nextIdx: number
    if (playMode === 'random') {
      nextIdx = Math.floor(Math.random() * queue.length)
    } else {
      nextIdx = (queueIndex + 1) % queue.length
    }
    set({ currentSong: queue[nextIdx], queueIndex: nextIdx, isPlaying: true })
  },

  prev: () => {
    const { queue, queueIndex } = get()
    if (queue.length === 0) return
    const prevIdx = queueIndex <= 0 ? queue.length - 1 : queueIndex - 1
    set({ currentSong: queue[prevIdx], queueIndex: prevIdx, isPlaying: true })
  },

  setVolume: (v) => {
    localStorage.setItem('volume', String(v))
    set({ volume: v })
  },

  setPlayMode: (m) => {
    localStorage.setItem('playMode', m)
    set({ playMode: m })
  },

  setShowFullPlayer: (show) => set({ showFullPlayer: show }),

  addToQueue: (song) =>
    set((s) => ({ queue: [...s.queue, song] })),

  removeFromQueue: (index) =>
    set((s) => {
      const newQueue = s.queue.filter((_, i) => i !== index)
      let newIndex = s.queueIndex
      if (index < newIndex) newIndex--
      else if (index === newIndex) newIndex = Math.min(newIndex, newQueue.length - 1)
      return { queue: newQueue, queueIndex: newIndex }
    }),

  clearQueue: () => set({ queue: [], queueIndex: -1 }),

  setTimer: (minutes) => {
    if (minutes === null) {
      set({ timerMinutes: null, timerEndTime: null })
    } else {
      set({
        timerMinutes: minutes,
        timerEndTime: Date.now() + minutes * 60 * 1000,
      })
    }
  },

  checkTimer: () => {
    const { timerEndTime, isPlaying } = get()
    if (!timerEndTime || !isPlaying) return false
    if (Date.now() >= timerEndTime) {
      set({ isPlaying: false, timerMinutes: null, timerEndTime: null })
      return true
    }
    return false
  },
}))
