import { getAdapter } from '@common/adapters'
import type { Song } from '@common/types'

export async function addRecentPlay(song: Song): Promise<void> {
  const db = getAdapter().db
  await db.execute(
    `INSERT OR REPLACE INTO recent_plays (song_name, singers, album, ext, duration, source, song_identifier, cover_url, played_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), 0)`,
    [song.song_name, song.singers, song.album || '', song.ext || 'mp3', song.duration_s || 0, song.source, song.song_identifier, song.cover_url || '']
  )
}

export async function getRecentPlays(limit = 50): Promise<(Song & { played_at: string })[]> {
  const db = getAdapter().db
  return db.query('SELECT * FROM recent_plays ORDER BY played_at DESC LIMIT ?', [limit])
}

export async function clearRecentPlays(): Promise<void> {
  const db = getAdapter().db
  await db.execute('DELETE FROM recent_plays')
}
