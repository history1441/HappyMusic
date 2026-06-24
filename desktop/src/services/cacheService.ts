import { getAdapter } from '@common/adapters'
import type { Song } from '@common/types'

export interface LocalSong {
  song_name: string
  singers: string
  album: string
  ext: string
  duration: number
  source: string
  song_identifier: string
  cover_url: string
  file_path: string
  file_size: number
}

export type LocalStatus = 'downloaded' | 'cached' | null

export async function checkLocal(source: string, identifier: string): Promise<{ status: LocalStatus; song: LocalSong | null }> {
  const db = getAdapter().db

  const downloads = await db.query<LocalSong>(
    'SELECT * FROM downloads WHERE source = ? AND song_identifier = ?',
    [source, identifier]
  )
  if (downloads.length > 0) return { status: 'downloaded', song: downloads[0] }

  const cached = await db.query<LocalSong>(
    'SELECT * FROM cache WHERE source = ? AND song_identifier = ?',
    [source, identifier]
  )
  if (cached.length > 0) return { status: 'cached', song: cached[0] }

  return { status: null, song: null }
}

export async function searchLocal(keyword: string): Promise<(LocalSong & { localStatus: LocalStatus })[]> {
  const db = getAdapter().db
  const pattern = `%${keyword}%`

  const downloads = await db.query<LocalSong>(
    'SELECT * FROM downloads WHERE song_name LIKE ? OR singers LIKE ?',
    [pattern, pattern]
  )
  const cached = await db.query<LocalSong>(
    'SELECT * FROM cache WHERE song_name LIKE ? OR singers LIKE ?',
    [pattern, pattern]
  )

  return [
    ...downloads.map(s => ({ ...s, localStatus: 'downloaded' as LocalStatus })),
    ...cached.map(s => ({ ...s, localStatus: 'cached' as LocalStatus })),
  ]
}

export async function updateCachePlayedAt(source: string, identifier: string): Promise<void> {
  const db = getAdapter().db
  await db.execute(
    'UPDATE cache SET last_played_at = datetime(\'now\', \'localtime\') WHERE source = ? AND song_identifier = ?',
    [source, identifier]
  )
}

export async function addToCache(song: {
  song_name: string; singers: string; album: string; ext: string
  duration: number; source: string; song_identifier: string
  cover_url: string; file_path: string; file_size: number
}): Promise<void> {
  const db = getAdapter().db
  await db.execute(
    `INSERT OR REPLACE INTO cache (song_name, singers, album, ext, duration, source, song_identifier, cover_url, file_path, file_size, last_played_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
    [song.song_name, song.singers, song.album, song.ext, song.duration, song.source, song.song_identifier, song.cover_url, song.file_path, song.file_size]
  )
}

export async function addToDownloads(song: {
  song_name: string; singers: string; album: string; ext: string
  duration: number; source: string; song_identifier: string
  cover_url: string; file_path: string; file_size: number
}): Promise<void> {
  const db = getAdapter().db
  await db.execute(
    `INSERT OR REPLACE INTO downloads (song_name, singers, album, ext, duration, source, song_identifier, cover_url, file_path, file_size, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
    [song.song_name, song.singers, song.album, song.ext, song.duration, song.source, song.song_identifier, song.cover_url, song.file_path, song.file_size]
  )
}

export async function removeDownload(source: string, identifier: string): Promise<string | null> {
  const db = getAdapter().db
  const rows = await db.query<{ file_path: string }>(
    'SELECT file_path FROM downloads WHERE source = ? AND song_identifier = ?',
    [source, identifier]
  )
  if (rows.length > 0) {
    await db.execute('DELETE FROM downloads WHERE source = ? AND song_identifier = ?', [source, identifier])
    return rows[0].file_path
  }
  return null
}

export async function removeCacheItem(source: string, identifier: string): Promise<string | null> {
  const db = getAdapter().db
  const rows = await db.query<{ file_path: string }>(
    'SELECT file_path FROM cache WHERE source = ? AND song_identifier = ?',
    [source, identifier]
  )
  if (rows.length > 0) {
    await db.execute('DELETE FROM cache WHERE source = ? AND song_identifier = ?', [source, identifier])
    return rows[0].file_path
  }
  return null
}

export async function getAllDownloads(): Promise<LocalSong[]> {
  const db = getAdapter().db
  return db.query<LocalSong>('SELECT * FROM downloads ORDER BY downloaded_at DESC')
}

export async function getAllCache(): Promise<LocalSong[]> {
  const db = getAdapter().db
  return db.query<LocalSong>('SELECT * FROM cache ORDER BY last_played_at DESC')
}
