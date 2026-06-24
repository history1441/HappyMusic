import { create } from 'zustand'
import TrackPlayer, { State } from 'react-native-track-player'
import * as FileSystem from 'expo-file-system/legacy'
import type { Song, PlayMode } from '../types'
import { cacheSong } from '../services/downloadService'
import { addRecentPlay } from '../services/recentService'
import { reportPlay } from '../services/statsService'
import { sendPlayerState } from '../services/syncService'
import { showToast } from '../components/Toast'
import api from '../services/api'
import { resetEndDetection, markManualSkip } from '../services/playbackService'

const PLAYER_STATE_FILE = `${FileSystem.documentDirectory}player_state.json`

let saveInterval: ReturnType<typeof setInterval> | null = null
let lastSaveTime = 0
let lastReportTime = 0
let lastReportPosition = 0
let lastPrecacheTime = 0
let isPlayerActive = false // Track if player is in use
let playSongVersion = 0 // 切歌版本号,旧请求在 await 后检查会提前退出

async function savePlayerState(state: { currentSong: Song | null; queue: Song[]; queueIndex: number; playMode: PlayMode; position: number }) {
  try {
    await FileSystem.writeAsStringAsync(PLAYER_STATE_FILE, JSON.stringify(state))
  } catch {}
}

async function loadPlayerState(): Promise<{ currentSong: Song | null; queue: Song[]; queueIndex: number; playMode: PlayMode; position: number } | null> {
  try {
    const info = await FileSystem.getInfoAsync(PLAYER_STATE_FILE)
    if (!info.exists) return null
    const content = await FileSystem.readAsStringAsync(PLAYER_STATE_FILE)
    return JSON.parse(content)
  } catch { return null }
}

async function checkLocal(source: string, identifier: string): Promise<{ status: string | null; song: any | null }> {
  try {
    const { getDB } = require('../database/schema')
    const db = await getDB()
    const download = await db.getFirstAsync('SELECT * FROM downloads WHERE source = ? AND song_identifier = ?', [source, identifier])
    if (download) return { status: 'downloaded', song: download }
    const cache = await db.getFirstAsync('SELECT * FROM cache WHERE source = ? AND song_identifier = ?', [source, identifier])
    if (cache) return { status: 'cached', song: cache }
    return { status: null, song: null }
  } catch { return { status: null, song: null } }
}

interface PlayerState {
  currentSong: Song | null
  isPlaying: boolean
  position: number
  duration: number
  playMode: PlayMode
  queue: Song[]
  queueIndex: number
  showFullPlayer: boolean
  isBuffering: boolean
  initializePlayer: () => Promise<void>
  playSong: (song: Song, list?: Song[]) => Promise<void>
  togglePlay: () => Promise<void>
  next: () => Promise<void>
  prev: () => Promise<void>
  seekTo: (seconds: number) => Promise<void>
  setPlayMode: (mode: PlayMode) => void
  setShowFullPlayer: (show: boolean) => void
  updateProgress: (position: number, duration: number) => void
  addToNext: (song: Song) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null, isPlaying: false, position: 0, duration: 0,
  playMode: 'sequence', queue: [], queueIndex: -1,
  showFullPlayer: false, isBuffering: false,

  initializePlayer: async () => {
    const saved = await loadPlayerState()
    if (saved?.currentSong) {
      const pos = saved.position || 0
      set({
        currentSong: saved.currentSong,
        queue: saved.queue || [saved.currentSong],
        queueIndex: saved.queueIndex ?? 0,
        playMode: saved.playMode || 'sequence',
        position: pos, duration: saved.currentSong.duration_s || 0,
        isPlaying: false,
      })
      try {
        const song = saved.currentSong
        const local = await checkLocal(song.source, song.song_identifier)
        let url: string
        if (local.song) { url = local.song.file_path }
        else if (song.download_url && song.with_valid_download_url) { url = song.download_url }
        else {
          try {
            const { data } = await api.post('/refresh-url', {
              song_name: song.song_name, singers: song.singers,
              source: song.source, song_identifier: song.song_identifier,
            })
            url = data.download_url || data.url
          } catch { url = song.download_url || '' }
        }
        if (url) {
          await TrackPlayer.reset()
          await TrackPlayer.add({
            id: `${song.source}_${song.song_identifier}`,
            url,
            title: song.song_name,
            artist: song.singers,
            artwork: song.cover_url || undefined,
            duration: song.duration_s || 0,
          })
          if (pos > 0) await TrackPlayer.seekTo(pos)
        }
      } catch (e) { console.warn('restore failed:', e) }
      startSaveInterval()
    }
  },

  playSong: async (song, list) => {
    const myVersion = ++playSongVersion
    let url: string
    set({ isBuffering: true })
    try {
      const local = await checkLocal(song.source, song.song_identifier)
      if (myVersion !== playSongVersion) return // 已被新的切歌请求取代
      if (local.song) {
        url = local.song.file_path
      } else if (song.download_url && song.with_valid_download_url) {
        url = song.download_url
        cacheSongInBackground(song, url).catch(() => {})
      } else {
        const { data } = await api.post('/refresh-url', {
          song_name: song.song_name, singers: song.singers,
          source: song.source, song_identifier: song.song_identifier,
        })
        if (myVersion !== playSongVersion) return // 已被新的切歌请求取代
        url = data.download_url || data.url
        if (data.cover_url && !song.cover_url) song = { ...song, cover_url: data.cover_url }
        if (data.lyric && !song.lyric) song = { ...song, lyric: data.lyric }
        cacheSongInBackground(song, url)
      }
    } catch (e) {
      if (myVersion !== playSongVersion) return // 已被新的切歌请求取代,不弹 Toast
      if (song.download_url) { url = song.download_url }
      else {
        console.warn('playSong error:', e)
        showToast('加载失败，请检查网络')
        set({ isBuffering: false, isPlaying: false })
        return
      }
    }

    if (myVersion !== playSongVersion) return // TrackPlayer 操作前的最终检查

    try {
      resetEndDetection()
      lastReportPosition = 0

      // 单轨队列：reset → add → play
      await TrackPlayer.reset()
      if (myVersion !== playSongVersion) return // reset 期间用户又切歌了
      await TrackPlayer.add({
        id: `${song.source}_${song.song_identifier}`,
        url,
        title: song.song_name,
        artist: song.singers,
        artwork: song.cover_url || undefined,
        duration: song.duration_s || 0,
      })
      await TrackPlayer.play()

      let queue: Song[], queueIndex: number
      if (list) {
        queue = list
        queueIndex = queue.findIndex(s => s.source === song.source && s.song_identifier === song.song_identifier)
      } else {
        const current = get()
        const existIdx = current.queue.findIndex(s => s.source === song.source && s.song_identifier === song.song_identifier)
        if (existIdx >= 0) { queue = current.queue; queueIndex = existIdx }
        else { queue = [...current.queue, song]; queueIndex = queue.length - 1 }
      }

      if (myVersion !== playSongVersion) return // 最终 set 前的检查,避免覆盖更新的状态

      addRecentPlay(song).catch(() => {})
      reportPlay(song, 0).catch(() => {})
      sendPlayerState({ song: { song_name: song.song_name, singers: song.singers }, is_playing: true, progress: 0 })

      set({
        currentSong: song, isPlaying: true, queue, queueIndex,
        position: 0, duration: song.duration_s || 0, isBuffering: false,
      })

      savePlayerState({ currentSong: song, queue, queueIndex, playMode: get().playMode, position: 0 })
      precacheUpcoming(queue, queueIndex, get().playMode)
      startSaveInterval()
    } catch (e) {
      if (myVersion !== playSongVersion) return // 旧请求的报错不打扰用户
      console.warn('TrackPlayer play error:', e)
      set({ isBuffering: false, isPlaying: false })
    }
  },

  togglePlay: async () => {
    try {
      const { isPlaying, position, duration, currentSong } = get()
      if (!isPlaying && position > 0 && duration > 0 && position >= duration - 2) {
        await TrackPlayer.seekTo(0)
        await TrackPlayer.play()
        set({ position: 0, isPlaying: true })
        return
      }
      if (isPlaying) {
        await TrackPlayer.pause()
      } else {
        const track = await TrackPlayer.getActiveTrack()
        if (!track && currentSong) {
          await get().playSong(currentSong)
          return
        }
        await TrackPlayer.play()
      }
    } catch {
      const { currentSong } = get()
      if (currentSong) get().playSong(currentSong)
    }
  },

  next: async () => {
    const { queue, queueIndex, playMode, currentSong, position } = get()
    if (currentSong && position > 0) {
      const delta = Math.max(0, position - lastReportPosition)
      if (delta > 1) reportPlay(currentSong, delta).catch(() => {})
      lastReportPosition = position
    }

    markManualSkip()

    let nextIdx: number
    if (playMode === 'random') {
      nextIdx = Math.floor(Math.random() * queue.length)
    } else if (playMode === 'single') {
      await TrackPlayer.seekTo(0)
      await TrackPlayer.play()
      resetEndDetection()
      set({ position: 0, isPlaying: true })
      return
    } else {
      nextIdx = (queueIndex + 1) % queue.length
    }
    if (queue[nextIdx]) await get().playSong(queue[nextIdx], queue)
  },

  prev: async () => {
    const { queue, queueIndex } = get()
    markManualSkip()
    const prevIdx = queueIndex > 0 ? queueIndex - 1 : queue.length - 1
    if (queue[prevIdx]) await get().playSong(queue[prevIdx], queue)
  },

  seekTo: async (seconds) => {
    try {
      const { currentSong, position } = get()
      if (currentSong && position > 0) {
        const delta = Math.max(0, position - lastReportPosition)
        if (delta > 1) reportPlay(currentSong, delta).catch(() => {})
      }
      lastReportPosition = seconds
      await TrackPlayer.seekTo(seconds)
      set({ position: seconds })
    } catch {}
  },

  setPlayMode: (mode) => set({ playMode: mode }),
  setShowFullPlayer: (show) => set({ showFullPlayer: show }),
  updateProgress: (position, duration) => set({ position, duration }),
  addToNext: (song) => {
    const { queue, queueIndex, playMode } = get()
    const newQueue = [...queue]
    newQueue.splice(queueIndex + 1, 0, song)
    set({ queue: newQueue })
    precacheUpcoming(newQueue, queueIndex, playMode)
  },
}))

function startSaveInterval() {
  if (saveInterval) clearInterval(saveInterval)
  isPlayerActive = true
  saveInterval = setInterval(() => {
    try {
      const s = usePlayerStore.getState()
      // 如果没有歌曲在播放，清理定时器
      if (!s.currentSong || (!s.isPlaying && s.position === 0)) {
        isPlayerActive = false
        clearInterval(saveInterval)
        saveInterval = null
        return
      }
      const now = Date.now()
      if (now - lastSaveTime > 5000) {
        lastSaveTime = now
        if (s.currentSong) savePlayerState({ currentSong: s.currentSong, queue: s.queue, queueIndex: s.queueIndex, playMode: s.playMode, position: s.position })
      }
      if (now - lastReportTime > 30000 && s.currentSong && s.isPlaying) {
        lastReportTime = now
        const delta = Math.max(0, s.position - lastReportPosition)
        if (delta > 1) { reportPlay(s.currentSong, delta).catch(() => {}); lastReportPosition = s.position }
      }
      // 每 30 秒重新检查预缓存
      if (now - lastPrecacheTime > 30000 && s.currentSong && s.queue.length > 1) {
        lastPrecacheTime = now
        precacheUpcoming(s.queue, s.queueIndex, s.playMode)
      }
    } catch {}
  }, 5000)
}

export function stopPlayerInterval() {
  isPlayerActive = false
  if (saveInterval) {
    clearInterval(saveInterval)
    saveInterval = null
  }
}

export function resumePlayerIntervalIfActive() {
  const s = usePlayerStore.getState()
  if (s.currentSong && s.isPlaying) {
    startSaveInterval()
  }
}

async function cacheSongInBackground(song: Song, url: string) {
  const tag = `[缓存] ${song.song_name}`
  try {
    console.warn(`${tag} 开始下载: ${url.substring(0, 80)}...`)
    const cacheDir = `${FileSystem.documentDirectory}music_cache/`
    const dirInfo = await FileSystem.getInfoAsync(cacheDir)
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true })
    const filename = `${song.source}_${song.song_identifier.replace(/[^a-zA-Z0-9]/g, '_')}.${song.ext || 'mp3'}`
    const filePath = `${cacheDir}${filename}`
    const result = await FileSystem.downloadAsync(url, filePath)
    const fileInf = await FileSystem.getInfoAsync(result.uri)
    const size = (fileInf as any).size || 0
    console.warn(`${tag} 下载完成: ${size} bytes, 写入数据库...`)
    await cacheSong(song, result.uri, size)
    console.warn(`${tag} 缓存成功!`)
    showToast(`已预缓存: ${song.song_name}`)
  } catch (e: any) {
    console.warn(`${tag} 缓存失败: ${e?.message || e}`)
  }
}

function precacheUpcoming(queue: Song[], queueIndex: number, playMode: PlayMode) {
  if (playMode !== 'sequence' || queue.length <= 1) return
  for (let i = 1; i <= 2; i++) {
    const idx = (queueIndex + i) % queue.length
    if (idx === queueIndex) continue
    const song = queue[idx]
    if (!song || !song.source || !song.song_identifier) {
      console.warn(`[预缓存] 跳过: song=${song?.song_name}, source=${song?.source}, id=${song?.song_identifier}`)
      continue
    }
    console.warn(`[预缓存] 检查第${i}首: ${song.song_name}`)
    checkLocal(song.source, song.song_identifier).then(({ status }) => {
      if (status) {
        console.warn(`[预缓存] ${song.song_name} 已有本地(${status}), 跳过`)
        return
      }
      console.warn(`[预缓存] ${song.song_name} 获取URL中...`)
      api.post('/refresh-url', { song_name: song.song_name, singers: song.singers, source: song.source, song_identifier: song.song_identifier })
        .then(({ data }) => {
          const downloadUrl = data.download_url || data.url
          if (downloadUrl) {
            console.warn(`[预缓存] ${song.song_name} URL获取成功, 开始下载`)
            cacheSongInBackground(song, downloadUrl)
          } else {
            console.warn(`[预缓存] ${song.song_name} URL为空: ${JSON.stringify(data).substring(0, 100)}`)
          }
        })
        .catch((e) => { console.warn(`[预缓存] ${song.song_name} refresh-url失败: ${e?.message || e}`) })
    }).catch((e) => { console.warn(`[预缓存] ${song.song_name} checkLocal失败: ${e?.message || e}`) })
  }
}
