export interface Song {
  song_name: string
  singers: string
  album: string
  ext: string
  file_size: string
  duration: string
  duration_s: number
  source: string
  song_identifier: string
  download_url: string
  cover_url: string
  lyric: string
  with_valid_download_url: boolean
}

export interface PlaylistSong {
  id: number
  song_name: string
  singers: string
  album: string
  ext: string
  duration: number
  file_size: string
  source: string
  song_identifier: string
  cover_url: string
  sort_order: number
  added_at: string
}

export interface Playlist {
  id: number
  name: string
  description: string
  cover: string
  is_favorite: boolean
  song_count: number
  created_at: string
  updated_at: string
  songs: PlaylistSong[]
}

export interface User {
  id: number
  username: string
  nickname: string
  avatar: string
  role?: string
  is_active?: boolean
  last_login_at?: string
  created_at?: string
}

export type PlayMode = 'sequence' | 'random' | 'single'
