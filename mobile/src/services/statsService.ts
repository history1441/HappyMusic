import api from './api'
import type { Song } from '../types'

export async function reportPlay(song: Song, playedDuration: number): Promise<void> {
  try {
    await api.post('/stats/play', {
      song_name: song.song_name,
      singers: song.singers,
      album: song.album || '',
      source: song.source,
      song_identifier: song.song_identifier,
      duration_s: song.duration_s || 0,
      played_duration: playedDuration,
      platform: 'android',
      cover_url: song.cover_url || '',
    })
  } catch {}
}

export async function fetchCloudRecent(limit = 50) {
  try {
    const { data } = await api.get('/stats/recent', { params: { limit } })
    return data.items || []
  } catch {
    return []
  }
}

export async function getStatsSummary() {
  try {
    const { data } = await api.get('/stats/summary')
    return data
  } catch {
    return null
  }
}
