import api from './api'
import type { Song } from '../types'
import { parseLyric } from '../utils/format'

export async function fetchLyrics(song: Song): Promise<{ time: number; text: string; translation?: string }[]> {
  // Try inline lyrics first
  if (song.lyric && /\[\d{1,2}:\d{2}/.test(song.lyric)) {
    return parseLyric(song.lyric)
  }
  // Fetch from API
  try {
    const { data } = await api.get('/lyrics', {
      params: { song_name: song.song_name, singers: song.singers, source: song.source },
    })
    if (data.lyric) return parseLyric(data.lyric)
  } catch {}
  try {
    const { data } = await api.post('/refresh-url', {
      song_name: song.song_name, singers: song.singers,
      source: song.source, song_identifier: song.song_identifier,
    })
    if (data.lyric) return parseLyric(data.lyric)
  } catch {}
  return []
}
