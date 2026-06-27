import { create } from 'zustand'
import { getAdapter } from '@common/adapters'
import { setAudioVolume } from '../adapters/audio'
import type { Song, PlayMode } from '@common/types'
import { makeTimerEndTime, isTimerExpired, shouldLoopBack, NO_AB_LOOP, type AbLoop } from '@common/utils/playerControls'
import api from '@common/services/api'
import { reportPlay } from '@common/services/statsService'
import { sendPlayerState } from '@common/services/syncService'
import { fetchLyrics } from '@common/services/lyricsService'

const STATE_KEY = 'player_state'

interface PlayerState {
  currentSong: Song | null
  isPlaying: boolean
  position: number
  duration: number
  playMode: PlayMode
  queue: Song[]
  queueIndex: number
  isBuffering: boolean
  lyrics: { time: number; text: string; translation?: string }[]
  volume: number
  rate: number
  timerEndTime: number | null
  abLoop: AbLoop

  initializePlayer: () => Promise<void>
  playSong: (song: Song, list?: Song[]) => Promise<void>
  togglePlay: () => Promise<void>
  next: () => Promise<void>
  prev: () => Promise<void>
  seekTo: (seconds: number) => Promise<void>
  setPlayMode: (mode: PlayMode) => void
  setVolume: (vol: number) => void
  updateProgress: (position: number, duration: number) => void
  addToNext: (song: Song) => void
  playAll: (songs: Song[]) => Promise<void>
  setRate: (rate: number) => Promise<void>
  setTimer: (minutes: number | null) => void
  toggleAbPoint: () => void
  clearAb: () => void
}

let progressInterval: ReturnType<typeof setInterval> | null = null
let lastSaveTime = 0
let lastReportTime = 0
let currentSongVersion = 0 // Track song changes to prevent race conditions

async function savePlayerState(state: {
  currentSong: Song | null
  queue: Song[]
  queueIndex: number
  playMode: PlayMode
  position: number
  rate?: number
}) {
  try {
    const { load } = await import('@tauri-apps/plugin-store')
    const store = await load('app-store.json', { autoSave: false } as any)
    await store.set(STATE_KEY, JSON.stringify(state))
    await store.save()
  } catch {}
}

async function loadPlayerState(): Promise<{
  currentSong: Song | null
  queue: Song[]
  queueIndex: number
  playMode: PlayMode
  position: number
  rate?: number
} | null> {
  try {
    const { load } = await import('@tauri-apps/plugin-store')
    const store = await load('app-store.json', { autoSave: false } as any)
    const raw = await store.get<string>(STATE_KEY)
    if (!raw) return null
    return JSON.parse(raw as string)
  } catch {
    return null
  }
}

async function checkLocal(source: string, identifier: string): Promise<{ status: string | null; filePath: string | null }> {
  try {
    const db = getAdapter().db
    const downloads = await db.query<any>(
      'SELECT file_path FROM downloads WHERE source = ? AND song_identifier = ?',
      [source, identifier]
    )
    if (downloads.length > 0) return { status: 'downloaded', filePath: downloads[0].file_path }
    const cache = await db.query<any>(
      'SELECT file_path FROM cache WHERE source = ? AND song_identifier = ?',
      [source, identifier]
    )
    if (cache.length > 0) return { status: 'cached', filePath: cache[0].file_path }
    return { status: null, filePath: null }
  } catch {
    return { status: null, filePath: null }
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  playMode: 'sequence',
  queue: [],
  queueIndex: -1,
  isBuffering: false,
  lyrics: [],
  volume: 1,
  rate: 1.0,
  timerEndTime: null,
  abLoop: { ...NO_AB_LOOP },

  initializePlayer: async () => {
    const saved = await loadPlayerState()
    if (saved?.currentSong) {
      set({
        currentSong: saved.currentSong,
        queue: saved.queue || [saved.currentSong],
        queueIndex: saved.queueIndex ?? 0,
        playMode: saved.playMode || 'sequence',
        position: saved.position || 0,
        duration: saved.currentSong.duration_s || 0,
        rate: saved.rate || 1.0,
      })
    }
  },

  playSong: async (song, list) => {
    let url: string
    set({ isBuffering: true })

    try {
      const local = await checkLocal(song.source, song.song_identifier)
      if (local.filePath) {
        url = local.filePath
      } else if (song.download_url && song.with_valid_download_url) {
        url = song.download_url
      } else {
        const { data } = await api.post('/refresh-url', {
          song_name: song.song_name,
          singers: song.singers,
          source: song.source,
          song_identifier: song.song_identifier,
        })
        url = data.download_url || data.url
      }
    } catch {
      if (song.download_url) {
        url = song.download_url
      } else {
        set({ isBuffering: false })
        return
      }
    }

    let queue: Song[], queueIndex: number
    if (list) {
      queue = list
      queueIndex = queue.findIndex(
        s => s.source === song.source && s.song_identifier === song.song_identifier
      )
      if (queueIndex < 0) queueIndex = 0
    } else {
      const current = get()
      const existIdx = current.queue.findIndex(
        s => s.source === song.source && s.song_identifier === song.song_identifier
      )
      if (existIdx >= 0) {
        queue = current.queue
        queueIndex = existIdx
      } else {
        queue = [...current.queue, song]
        queueIndex = queue.length - 1
      }
    }

    try {
      await getAdapter().audio.play({ ...song, download_url: url } as Song)
      // 应用当前倍速(Howl 每次新建后速率会重置)
      getAdapter().audio.setRate(get().rate).catch(() => {})

      // Record play
      try {
        const { addRecentPlay } = await import('../services/recentService')
        addRecentPlay(song).catch(() => {})
      } catch {}
      reportPlay(song, 0).catch(() => {})
      sendPlayerState({
        song: { song_name: song.song_name, singers: song.singers },
        is_playing: true,
        progress: 0,
      })

      // Load lyrics
      let lyrics: { time: number; text: string; translation?: string }[] = []
      try { lyrics = await fetchLyrics(song) } catch {}

      set({
        currentSong: song,
        isPlaying: true,
        queue,
        queueIndex,
        position: 0,
        duration: song.duration_s || 0,
        isBuffering: false,
        lyrics,
      })

      savePlayerState({
        currentSong: song,
        queue,
        queueIndex,
        playMode: get().playMode,
        position: 0,
        rate: get().rate,
      })
      startProgressPolling()

      // Background cache: save to local cache while streaming
      cacheSongInBackground(song, url).catch(() => {})
    } catch {
      set({ isBuffering: false })
    }
  },

  togglePlay: async () => {
    const { isPlaying, currentSong } = get()
    if (!currentSong) return
    try {
      if (isPlaying) {
        await getAdapter().audio.pause()
        set({ isPlaying: false })
      } else {
        await getAdapter().audio.resume()
        set({ isPlaying: true })
      }
    } catch {
      await get().playSong(currentSong)
    }
  },

  next: async () => {
    const { queue, queueIndex, playMode, currentSong, position } = get()
    if (currentSong && position > 0) {
      reportPlay(currentSong, position).catch(() => {})
    }
    let nextIdx: number
    if (playMode === 'random') {
      nextIdx = Math.floor(Math.random() * queue.length)
    } else if (playMode === 'single') {
      nextIdx = queueIndex
    } else {
      nextIdx = (queueIndex + 1) % queue.length
    }
    if (queue[nextIdx]) {
      await get().playSong(queue[nextIdx], queue)
    }
  },

  prev: async () => {
    const { queue, queueIndex } = get()
    const prevIdx = queueIndex > 0 ? queueIndex - 1 : queue.length - 1
    if (queue[prevIdx]) {
      await get().playSong(queue[prevIdx], queue)
    }
  },

  seekTo: async (seconds) => {
    try {
      currentSongVersion++ // Prevent seek from triggering false track-end
      await getAdapter().audio.seekTo(seconds)
      set({ position: seconds })
    } catch {}
  },

  setPlayMode: (mode) => set({ playMode: mode }),

  setVolume: (vol) => {
    const v = Math.max(0, Math.min(1, vol))
    setAudioVolume(v)
    set({ volume: v })
  },

  updateProgress: (position, duration) => set({ position, duration }),

  addToNext: (song) => {
    const { queue, queueIndex } = get()
    const newQueue = [...queue]
    newQueue.splice(queueIndex + 1, 0, song)
    set({ queue: newQueue })
  },

  playAll: async (songs) => {
    if (songs.length > 0) {
      await get().playSong(songs[0], songs)
    }
  },

  setRate: async (rate) => {
    set({ rate })
    try { await getAdapter().audio.setRate(rate) } catch {}
  },

  setTimer: (minutes) => {
    set({ timerEndTime: makeTimerEndTime(minutes || 0) })
  },

  toggleAbPoint: () => {
    const { position, abLoop } = get()
    let next: AbLoop
    if (abLoop.a == null) next = { a: position, b: null }
    else if (abLoop.b == null) next = position > abLoop.a ? { a: abLoop.a, b: position } : { a: position, b: null }
    else next = { a: position, b: null }
    set({ abLoop: next })
  },

  clearAb: () => set({ abLoop: { ...NO_AB_LOOP } }),
}))

async function cacheSongInBackground(song: Song, url: string) {
  const local = await checkLocal(song.source, song.song_identifier)
  if (local.filePath) return

  try {
    const fs = getAdapter().fs
    const ext = song.ext || 'mp3'
    const safeName = song.song_name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 80)
    const fileName = `${safeName}_${song.source}_${song.song_identifier}.${ext}`
    const filePath = await fs.download(url, fileName)

    const db = getAdapter().db
    await db.execute(
      `INSERT OR REPLACE INTO cache (song_name, singers, album, ext, duration, source, song_identifier, cover_url, file_path, file_size, last_played_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now', 'localtime'))`,
      [song.song_name, song.singers, song.album || '', ext, song.duration_s || 0,
       song.source, song.song_identifier, song.cover_url || '', filePath]
    )
  } catch {}
}

function startProgressPolling() {
  if (progressInterval) clearInterval(progressInterval)
  currentSongVersion++ // Increment on song change to prevent stale events
  let trackEndedHandled = false

  progressInterval = setInterval(async () => {
    try {
      const s = usePlayerStore.getState()
      // Auto-cleanup: if no song or not playing, stop polling
      if (!s.currentSong || (!s.isPlaying && s.position === 0)) {
        if (progressInterval) {
          clearInterval(progressInterval)
          progressInterval = null
        }
        return
      }

      const progress = await getAdapter().audio.getProgress()
      const state = await getAdapter().audio.getState()
      usePlayerStore.getState().updateProgress(progress.position, progress.duration)
      usePlayerStore.setState({ isBuffering: state === 'buffering' })

      // 睡眠定时到期 → 暂停并清空
      if (isTimerExpired(s.timerEndTime) && s.isPlaying) {
        await getAdapter().audio.pause()
        usePlayerStore.setState({ isPlaying: false, timerEndTime: null })
        return
      }
      // AB 段复读:越过 B 点则回到 A 点
      if (shouldLoopBack(progress.position, s.abLoop)) {
        await getAdapter().audio.seekTo(s.abLoop.a as number)
        return
      }

      const ver = currentSongVersion // Snapshot version
      const reachedEnd = progress.duration > 0 && progress.position >= progress.duration - 0.5
      const notPlaying = state !== 'playing' && state !== 'buffering'

      // Only trigger next if version hasn't changed (not a seek)
      if (reachedEnd && notPlaying && s.isPlaying && !trackEndedHandled && currentSongVersion === ver) {
        trackEndedHandled = true
        usePlayerStore.setState({ isPlaying: false })
        s.next()
        return
      }
      if (!reachedEnd) trackEndedHandled = false

      // Debounced save every 5s
      const now = Date.now()
      if (now - lastSaveTime > 5000) {
        lastSaveTime = now
        if (s.currentSong) {
          savePlayerState({
            currentSong: s.currentSong,
            queue: s.queue,
            queueIndex: s.queueIndex,
            playMode: s.playMode,
            position: s.position,
            rate: s.rate,
          })
        }
      }

      // Report play every 30s
      if (now - lastReportTime > 30000 && s.currentSong && s.isPlaying) {
        lastReportTime = now
        reportPlay(s.currentSong, s.position).catch(() => {})
      }

      // Sync state
      if (s.currentSong) {
        sendPlayerState({
          song: { song_name: s.currentSong.song_name, singers: s.currentSong.singers },
          is_playing: s.isPlaying,
          progress: s.position,
        })
      }
    } catch {}
  }, 500)
}
