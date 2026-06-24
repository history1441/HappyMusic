export type { Song, PlaylistSong, Playlist, User, PlayMode } from '@happymusic/common'

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
