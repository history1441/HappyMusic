import api from './api'
import type { Playlist, Song } from '../types'

/** 获取用户所有歌单 */
export async function loadPlaylists(): Promise<Playlist[]> {
  const { data } = await api.get('/playlists')
  return data.playlists || data || []
}

/** 获取歌单详情(含歌曲列表) */
export async function getPlaylistDetail(playlistId: number): Promise<Playlist> {
  const { data } = await api.get(`/playlists/${playlistId}`)
  return data
}

/** 创建歌单 */
export async function createPlaylist(name: string, description = '', isFavorite = false) {
  const { data } = await api.post('/playlists', {
    name, description, is_favorite: isFavorite,
  })
  return data
}

/** 删除歌单 */
export async function deletePlaylist(playlistId: number): Promise<void> {
  await api.delete(`/playlists/${playlistId}`)
}

/** 添加歌曲到歌单 */
export async function addToPlaylist(playlistId: number, song: Song): Promise<void> {
  await api.post(`/playlists/${playlistId}/songs`, {
    song_name: song.song_name,
    singers: song.singers,
    album: song.album || '',
    ext: song.ext || 'mp3',
    duration: song.duration_s || 0,
    source: song.source,
    song_identifier: song.song_identifier,
    lyric: song.lyric || '',
    cover_url: song.cover_url || '',
  })
}

/** 从歌单移除歌曲 */
export async function removeFromPlaylist(playlistId: number, songId: number): Promise<void> {
  await api.delete(`/playlists/${playlistId}/songs/${songId}`)
}

/** 获取收藏歌单(含歌曲) */
export async function getFavorites(): Promise<Playlist | null> {
  const playlists = await loadPlaylists()
  return playlists.find((p) => p.is_favorite) || null
}
