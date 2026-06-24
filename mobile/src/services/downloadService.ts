import * as FileSystem from 'expo-file-system/legacy'
import api from './api'
import { addToDownloads, removeDownload } from './cacheService'
import { DOWNLOAD_DIR, CACHE_DIR } from '../utils/constants'
import type { Song } from '../types'

const musicDir = `${FileSystem.documentDirectory}${DOWNLOAD_DIR}/`
const cacheDir = `${FileSystem.documentDirectory}${CACHE_DIR}/`

async function ensureDir(dir: string) {
  const info = await FileSystem.getInfoAsync(dir)
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
}

export async function downloadSong(song: Song): Promise<string> {
  await ensureDir(musicDir)

  let url = song.download_url
  if (!url) {
    const { data } = await api.post('/refresh-url', {
      song_name: song.song_name, singers: song.singers,
      source: song.source, song_identifier: song.song_identifier,
    })
    url = data.download_url
  }

  const filename = `${song.source}_${song.song_identifier.replace(/[^a-zA-Z0-9]/g, '_')}.${song.ext || 'mp3'}`
  const filePath = `${musicDir}${filename}`

  const result = await FileSystem.downloadAsync(url, filePath)
  const info = await FileSystem.getInfoAsync(result.uri)

  await addToDownloads({
    song_name: song.song_name, singers: song.singers, album: song.album || '',
    ext: song.ext || 'mp3', duration: song.duration_s || 0,
    source: song.source, song_identifier: song.song_identifier,
    cover_url: song.cover_url || '', file_path: result.uri,
    file_size: (info as any).size || 0,
  })

  return result.uri
}

export async function deleteDownload(source: string, identifier: string): Promise<void> {
  const filePath = await removeDownload(source, identifier)
  if (filePath) {
    const info = await FileSystem.getInfoAsync(filePath)
    if (info.exists) await FileSystem.deleteAsync(filePath)
  }
}

export async function cacheSong(song: Song, filePath: string, fileSize: number): Promise<void> {
  const { addToCache } = await import('./cacheService')
  await addToCache({
    song_name: song.song_name, singers: song.singers, album: song.album || '',
    ext: song.ext || 'mp3', duration: song.duration_s || 0,
    source: song.source, song_identifier: song.song_identifier,
    cover_url: song.cover_url || '', file_path: filePath, file_size: fileSize,
  })
}

export async function getStorageInfo(): Promise<{
  total: number; free: number; downloadSize: number; cacheSize: number
}> {
  const free = await FileSystem.getFreeDiskStorageAsync()
  const total = await FileSystem.getTotalDiskCapacityAsync()

  const { getDB } = await import('../database/schema')
  const db = await getDB()
  const dlResult = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(file_size), 0) as total FROM downloads')
  const cacheResult = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(file_size), 0) as total FROM cache')

  return {
    total: Number(total),
    free: Number(free),
    downloadSize: dlResult?.total || 0,
    cacheSize: cacheResult?.total || 0,
  }
}
