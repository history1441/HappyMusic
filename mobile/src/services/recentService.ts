import { getDB } from '../database/schema'
import api from './api'
import type { Song } from '../types'

export async function addRecentPlay(song: Song): Promise<void> {
  const db = await getDB()
  await db.runAsync(
    `INSERT OR REPLACE INTO recent_plays (song_name, singers, album, ext, duration_s, source, song_identifier, cover_url, lyric, played_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [song.song_name, song.singers, song.album || '', song.ext || 'mp3', song.duration_s || 0, song.source, song.song_identifier, song.cover_url || '', song.lyric || '', Date.now()]
  )
}

export async function getRecentPlays(limit = 50): Promise<(Song & { played_at: number })[]> {
  const db = await getDB()
  return db.getAllAsync('SELECT * FROM recent_plays ORDER BY played_at DESC LIMIT ?', [limit])
}

export async function clearRecentPlays(): Promise<void> {
  const db = await getDB()
  await db.runAsync('DELETE FROM recent_plays')
}

export async function syncRecentToCloud(): Promise<void> {
  try {
    const db = await getDB()
    const unsynced = await db.getAllAsync(
      'SELECT * FROM recent_plays WHERE synced = 0 LIMIT 50'
    ) as any[]
    for (const play of unsynced) {
      await api.post('/stats/play', {
        song_name: play.song_name,
        singers: play.singers,
        album: play.album || '',
        source: play.source,
        song_identifier: play.song_identifier,
        duration_s: play.duration_s || 0,
        played_duration: 0,
        platform: 'android',
      })
    }
    await db.runAsync('UPDATE recent_plays SET synced = 1 WHERE synced = 0')
  } catch {}
}

export async function fetchCloudRecent(): Promise<any[]> {
  try {
    const { data } = await api.get('/stats/recent', { params: { limit: 50 } })
    return data.items || []
  } catch {
    return []
  }
}
