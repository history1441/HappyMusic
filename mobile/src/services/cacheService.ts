import { getDB } from '../database/schema'
import type { LocalSong, LocalStatus } from '../types'

export async function checkLocal(source: string, identifier: string): Promise<{ status: LocalStatus; song: LocalSong | null }> {
  const db = await getDB()
  const download = await db.getFirstAsync<LocalSong>(
    'SELECT * FROM downloads WHERE source = ? AND song_identifier = ?',
    [source, identifier]
  )
  if (download) return { status: 'downloaded', song: download }

  const cache = await db.getFirstAsync<LocalSong>(
    'SELECT * FROM cache WHERE source = ? AND song_identifier = ?',
    [source, identifier]
  )
  if (cache) return { status: 'cached', song: cache }

  return { status: null, song: null }
}

export async function searchLocal(keyword: string): Promise<(LocalSong & { localStatus: LocalStatus })[]> {
  const db = await getDB()
  const pattern = `%${keyword}%`
  const downloads = await db.getAllAsync<LocalSong>(
    'SELECT * FROM downloads WHERE song_name LIKE ? OR singers LIKE ?', [pattern, pattern]
  )
  const cached = await db.getAllAsync<LocalSong>(
    'SELECT * FROM cache WHERE song_name LIKE ? OR singers LIKE ?', [pattern, pattern]
  )
  return [
    ...downloads.map(s => ({ ...s, localStatus: 'downloaded' as LocalStatus })),
    ...cached.map(s => ({ ...s, localStatus: 'cached' as LocalStatus })),
  ]
}

export async function updateCachePlayedAt(source: string, identifier: string): Promise<void> {
  const db = await getDB()
  await db.runAsync(
    'UPDATE cache SET last_played_at = ? WHERE source = ? AND song_identifier = ?',
    [Date.now(), source, identifier]
  )
}

export async function addToCache(song: {
  song_name: string; singers: string; album: string; ext: string
  duration: number; source: string; song_identifier: string
  cover_url: string; file_path: string; file_size: number
}): Promise<void> {
  const db = await getDB()
  const now = Date.now()
  await db.runAsync(
    `INSERT OR REPLACE INTO cache (song_name, singers, album, ext, duration, source, song_identifier, cover_url, file_path, file_size, cached_at, last_played_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [song.song_name, song.singers, song.album, song.ext, song.duration, song.source, song.song_identifier, song.cover_url, song.file_path, song.file_size, now, now]
  )
  // 异步执行缓存限制检查，不阻塞当前操作
  try {
    const { useCacheLimitStore } = require('../stores/cacheLimitStore')
    const { enforceCacheLimit } = require('./storageService')
    const maxMB = useCacheLimitStore.getState().maxMB
    if (maxMB > 0) await enforceCacheLimit(maxMB)
  } catch {}
}

export async function addToDownloads(song: {
  song_name: string; singers: string; album: string; ext: string
  duration: number; source: string; song_identifier: string
  cover_url: string; file_path: string; file_size: number
}): Promise<void> {
  const db = await getDB()
  await db.runAsync(
    `INSERT OR REPLACE INTO downloads (song_name, singers, album, ext, duration, source, song_identifier, cover_url, file_path, file_size, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [song.song_name, song.singers, song.album, song.ext, song.duration, song.source, song.song_identifier, song.cover_url, song.file_path, song.file_size, Date.now()]
  )
}

export async function removeDownload(source: string, identifier: string): Promise<string | null> {
  const db = await getDB()
  const row = await db.getFirstAsync<{ file_path: string }>(
    'SELECT file_path FROM downloads WHERE source = ? AND song_identifier = ?',
    [source, identifier]
  )
  if (row) {
    await db.runAsync('DELETE FROM downloads WHERE source = ? AND song_identifier = ?', [source, identifier])
    return row.file_path
  }
  return null
}

export async function getAllDownloads(): Promise<LocalSong[]> {
  const db = await getDB()
  return db.getAllAsync<LocalSong>('SELECT * FROM downloads ORDER BY downloaded_at DESC')
}

export async function getAllCache(): Promise<LocalSong[]> {
  const db = await getDB()
  return db.getAllAsync<LocalSong>('SELECT * FROM cache ORDER BY cached_at DESC')
}
