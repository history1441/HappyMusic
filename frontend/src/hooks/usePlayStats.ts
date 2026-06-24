import api from '../services/api'
import type { Song } from '../types'

export function reportPlay(song: Song, playedDuration: number) {
  api.post('/stats/play', {
    song_name: song.song_name,
    singers: song.singers,
    album: song.album || '',
    source: song.source,
    song_identifier: song.song_identifier,
    duration_s: song.duration_s,
    played_duration: playedDuration,
  }).catch(() => {})
}
