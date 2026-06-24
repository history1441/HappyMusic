import { create } from 'zustand'
import api from '../services/api'
import { saveSong, saveLocalFile, songId } from '../hooks/useDB'
import type { Song } from '../types'

export interface DownloadTask {
  id: string
  song: Song
  progress: number
  status: 'pending' | 'downloading' | 'done' | 'error'
  error?: string
}

interface DownloadState {
  tasks: DownloadTask[]
  addTask: (song: Song) => void
  removeTask: (id: string) => void
  clearDone: () => void
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  tasks: [],

  addTask: (song) => {
    const id = songId(song.source, song.song_identifier)
    const existing = get().tasks.find((t) => t.id === id)
    if (existing) return

    const task: DownloadTask = { id, song, progress: 0, status: 'pending' }
    set((s) => ({ tasks: [...s.tasks, task] }))
    _download(task)
  },

  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  clearDone: () => set((s) => ({ tasks: s.tasks.filter((t) => t.status !== 'done' && t.status !== 'error') })),
}))

async function _download(task: DownloadTask) {
  const store = useDownloadStore
  const id = task.id
  const song = task.song

  store.setState((s) => ({
    tasks: s.tasks.map((t) => t.id === id ? { ...t, status: 'downloading', progress: 0 } : t),
  }))

  try {
    // Get download URL via refresh-url API
    const { data } = await api.post('/refresh-url', {
      song_name: song.song_name, singers: song.singers,
      source: song.source, song_identifier: song.song_identifier,
    })
    const url = data.download_url

    // Download directly without proxy
    const resp = await fetch(url, { mode: 'cors' }).catch(async () => {
      // If CORS blocks, use proxy as fallback
      const token = localStorage.getItem('access_token')
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`
      return fetch(proxyUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    })

    if (!resp.ok) throw new Error(`下载失败: ${resp.status}`)

    const contentLength = resp.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength) : 0
    const reader = resp.body?.getReader()
    if (!reader) throw new Error('无法读取响应')

    const chunks: BlobPart[] = []
    let received = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      const progress = total > 0 ? Math.round((received / total) * 100) : 0
      store.setState((s) => ({
        tasks: s.tasks.map((t) => t.id === id ? { ...t, progress } : t),
      }))
    }

    const ext = song.ext || 'mp3'
    const mimeType = ext === 'flac' ? 'audio/flac' : ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : 'audio/mpeg'
    const blob = new Blob(chunks, { type: mimeType })

    // Save to cache (IndexedDB)
    await saveSong(id, blob, {
      song_name: song.song_name,
      singers: song.singers,
      album: song.album || '',
      ext,
      duration: song.duration_s || 0,
      source: song.source,
      song_identifier: song.song_identifier,
      cover_url: song.cover_url || '',
    })

    // Also save to local music library
    const localId = `local:${song.song_name}-${song.source}-${song.song_identifier}`
    await saveLocalFile(localId, blob, {
      name: song.song_name,
      artists: song.singers,
      album: song.album || '',
      duration: song.duration_s || 0,
      type: ext.toUpperCase(),
      size: blob.size,
      coverUrl: song.cover_url || '',
    })

    store.setState((s) => ({
      tasks: s.tasks.map((t) => t.id === id ? { ...t, status: 'done', progress: 100 } : t),
    }))
  } catch (err: any) {
    store.setState((s) => ({
      tasks: s.tasks.map((t) => t.id === id ? { ...t, status: 'error', error: err.message } : t),
    }))
  }
}
