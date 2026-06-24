import { create } from 'zustand'
import * as FileSystem from 'expo-file-system/legacy'
import api from '../services/api'
import { addToDownloads } from '../services/cacheService'
import { DOWNLOAD_DIR } from '../utils/constants'
import type { Song } from '../types'

const musicDir = `${FileSystem.documentDirectory}${DOWNLOAD_DIR}/`
const MAX_CONCURRENT = 2
let activeDownloads = 0
const progressLastUpdate = new Map<string, number>()
const PROGRESS_THROTTLE_MS = 500

async function ensureDir(dir: string) {
  const info = await FileSystem.getInfoAsync(dir)
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
}

export interface DownloadTask {
  id: string
  song: Song
  progress: number
  status: 'pending' | 'downloading' | 'done' | 'error'
  error?: string
}

interface DownloadState {
  tasks: DownloadTask[]
  initialized: boolean
  initialize: () => Promise<void>
  addTask: (song: Song) => void
  removeTask: (id: string) => void
  clearDone: () => void
}

type DownloadSet = (partial: Partial<DownloadState> | ((s: DownloadState) => Partial<DownloadState>)) => void
type DownloadGet = () => DownloadState

async function restoreCompletedTasks(): Promise<DownloadTask[]> {
  try {
    const { getDB } = require('../database/schema')
    const db = await getDB()
    const downloads = await db.getAllAsync('SELECT * FROM downloads ORDER BY downloaded_at DESC LIMIT 50')
    return downloads.map((d: any) => ({
      id: `${d.source}_${d.song_identifier}`,
      song: {
        song_name: d.song_name, singers: d.singers, album: d.album || '',
        ext: d.ext || 'mp3', duration_s: d.duration || 0, source: d.source,
        song_identifier: d.song_identifier, cover_url: d.cover_url || '',
        download_url: d.file_path || '', lyric: '', file_size: String(d.file_size || ''),
        duration: String(d.duration || ''), with_valid_download_url: !!d.file_path,
      },
      progress: 100,
      status: 'done' as const,
    }))
  } catch {
    return []
  }
}

async function runDownload(song: Song, id: string, set: DownloadSet, get: DownloadGet) {
  try {
    set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'downloading' } : t) }))

    let url = song.download_url
    if (!url) {
      try {
        const { data } = await api.post('/refresh-url', {
          song_name: song.song_name, singers: song.singers,
          source: song.source, song_identifier: song.song_identifier,
        })
        url = data.download_url || data.url
      } catch (err: any) {
        console.warn('Download: refresh-url failed for', song.song_name, err?.message || err)
        throw err
      }
    }

    await ensureDir(musicDir)
    const filename = `${song.source}_${song.song_identifier.replace(/[^a-zA-Z0-9]/g, '_')}.${song.ext || 'mp3'}`
    const filePath = `${musicDir}${filename}`

    const resumable = FileSystem.createDownloadResumable(
      url, filePath, {},
      (dlProgress) => {
        const progress = Math.round((dlProgress.totalBytesWritten / dlProgress.totalBytesExpectedToWrite) * 100)
        // 节流:500ms 内不重复更新 setState,除非达到 100%
        const now = Date.now()
        const last = progressLastUpdate.get(id) ?? 0
        if (now - last < PROGRESS_THROTTLE_MS && progress < 100) return
        progressLastUpdate.set(id, now)
        set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, progress } : t) }))
      }
    )

    const result = await resumable.downloadAsync()
    if (!result) throw new Error('下载取消')

    const fileInf = await FileSystem.getInfoAsync(result.uri)

    await addToDownloads({
      song_name: song.song_name, singers: song.singers, album: song.album || '',
      ext: song.ext || 'mp3', duration: song.duration_s || 0,
      source: song.source, song_identifier: song.song_identifier,
      cover_url: song.cover_url || '', file_path: result.uri,
      file_size: (fileInf as any).size || 0,
    })

    set(s => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, progress: 100, status: 'done' } : t),
    }))
  } catch (e: any) {
    set(s => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'error', error: e?.message || '下载失败' } : t),
    }))
  } finally {
    progressLastUpdate.delete(id)
    activeDownloads = Math.max(0, activeDownloads - 1)
    pumpQueue(set, get)
  }
}

function pumpQueue(set: DownloadSet, get: DownloadGet) {
  if (activeDownloads >= MAX_CONCURRENT) return
  const next = get().tasks.find(t => t.status === 'pending')
  if (!next) return
  activeDownloads++
  void runDownload(next.song, next.id, set, get)
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  tasks: [],
  initialized: false,

  initialize: async () => {
    if (get().initialized) return
    const completed = await restoreCompletedTasks()
    set({ tasks: completed, initialized: true })
  },

  addTask: (song) => {
    const id = `${song.source}_${song.song_identifier}`
    const existing = get().tasks.find(t => t.id === id)
    if (existing && existing.status !== 'error') return

    const task: DownloadTask = { id, song, progress: 0, status: 'pending' }
    set(s => {
      const filtered = s.tasks.filter(t => t.id !== id)
      return { tasks: [...filtered, task] }
    })

    // 由 pumpQueue 决定立即启动还是排队等待
    pumpQueue(set, get)
  },

  removeTask: (id) => set(s => ({ tasks: s.tasks.filter(t => t.id !== id) })),

  clearDone: () => set(s => ({
    tasks: s.tasks.filter(t => t.status === 'downloading' || t.status === 'pending'),
  })),
}))
