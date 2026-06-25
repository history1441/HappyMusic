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

// ========== API 契约类型(三端共用,减少 any) ==========

export interface ApiResponse<T> {
  data: T
  message?: string
  code?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

export interface ErrorResponse {
  detail: string
  code?: string
}

export interface SearchRequest {
  keyword: string
  sources?: string[]
  page?: number
  page_size?: number
}

export interface SearchResult {
  keyword: string
  results: Song[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type?: string
}

export interface Announcement {
  id: number
  title: string
  content: string
  type?: string
  is_pinned?: boolean
  created_at?: string
}
