import { load, type Store } from '@tauri-apps/plugin-store'
import api from '@common/services/api'
import type { Playlist, Song } from '@common/types'

const CACHE_KEY = 'playlists_cache'
let _store: Store | null = null

async function getStore(): Promise<Store> {
  if (!_store) _store = await load('app-store.json', { autoSave: false } as any)
  return _store
}

// --- Favorite playlist ID cache ---
let _favPlaylistId: number | null = null

export function getFavPlaylistId(): number | null {
  return _favPlaylistId
}

// --- Playlist list: cache-first, then refresh ---

export async function loadPlaylistsCached(): Promise<Playlist[]> {
  const cached = await _readCache()
  if (cached.length > 0) return cached

  const remote = await _fetchRemote()
  await _writeCache(remote)
  return remote
}

export async function refreshPlaylists(): Promise<Playlist[]> {
  const remote = await _fetchRemote()
  await _writeCache(remote)
  return remote
}

async function _fetchRemote(): Promise<Playlist[]> {
  try {
    const { data } = await api.get('/playlists')
    const playlists = data.playlists || data || []
    const fav = playlists.find((p: Playlist) => p.is_favorite)
    _favPlaylistId = fav?.id ?? null
    return playlists
  } catch {
    return []
  }
}

async function _readCache(): Promise<Playlist[]> {
  try {
    const store = await getStore()
    const data = await store.get<{ playlists: Playlist[]; favId: number | null }>(CACHE_KEY)
    if (data && Array.isArray(data.playlists)) {
      _favPlaylistId = data.favId ?? null
      return data.playlists
    }
  } catch {}
  return []
}

async function _writeCache(playlists: Playlist[]): Promise<void> {
  try {
    const store = await getStore()
    await store.set(CACHE_KEY, { playlists, favId: _favPlaylistId })
    await store.save()
  } catch {}
}

// --- Favorite operations ---

export async function ensureFavPlaylist(): Promise<number> {
  if (_favPlaylistId) return _favPlaylistId

  // Try find existing
  const playlists = await _fetchRemote()
  const fav = playlists.find(p => p.is_favorite)
  if (fav) {
    _favPlaylistId = fav.id
    return fav.id
  }

  // Create one
  const { data } = await api.post('/playlists', { name: '我喜欢的', description: '', is_favorite: true })
  _favPlaylistId = data.id
  return data.id
}

export async function addToFavorites(song: Song): Promise<boolean> {
  try {
    const favId = await ensureFavPlaylist()
    await api.post(`/playlists/${favId}/songs`, {
      song_name: song.song_name,
      singers: song.singers,
      album: song.album || '',
      ext: song.ext || 'mp3',
      duration: song.duration_s || 0,
      source: song.source,
      song_identifier: song.song_identifier,
      cover_url: song.cover_url || '',
      lyric: song.lyric || '',
    })
    // Update cache incrementally
    const cached = await _readCache()
    const fav = cached.find(p => p.id === favId)
    if (fav) {
      fav.song_count += 1
      await _writeCache(cached)
    }
    return true
  } catch {
    return false
  }
}

export async function removeFromFavorites(source: string, songIdentifier: string): Promise<boolean> {
  if (!_favPlaylistId) return false
  try {
    // Need to find the song ID in the playlist first
    const { data } = await api.get(`/playlists/${_favPlaylistId}`)
    const songs = data.songs || []
    const match = songs.find((s: any) => s.source === source && s.song_identifier === songIdentifier)
    if (match) {
      await api.delete(`/playlists/${_favPlaylistId}/songs/${match.id}`)
      const cached = await _readCache()
      const fav = cached.find(p => p.id === _favPlaylistId)
      if (fav) {
        fav.song_count = Math.max(0, fav.song_count - 1)
        await _writeCache(cached)
      }
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function isSongFavorited(source: string, songIdentifier: string): Promise<boolean> {
  if (!_favPlaylistId) {
    await loadPlaylistsCached()
    if (!_favPlaylistId) return false
  }
  try {
    const { data } = await api.get(`/playlists/${_favPlaylistId}`)
    const songs = data.songs || []
    return songs.some((s: any) => s.source === source && s.song_identifier === songIdentifier)
  } catch {
    return false
  }
}

// --- Playlist CRUD ---

export async function createPlaylist(name: string): Promise<Playlist | null> {
  try {
    const { data } = await api.post('/playlists', { name, description: '' })
    const cached = await _readCache()
    cached.unshift(data)
    await _writeCache(cached)
    return data
  } catch {
    return null
  }
}

export async function deletePlaylist(id: number): Promise<boolean> {
  try {
    await api.delete(`/playlists/${id}`)
    const cached = await _readCache()
    await _writeCache(cached.filter(p => p.id !== id))
    return true
  } catch {
    return false
  }
}

export async function updatePlaylist(id: number, name: string): Promise<boolean> {
  try {
    await api.put(`/playlists/${id}`, { name })
    const cached = await _readCache()
    const pl = cached.find(p => p.id === id)
    if (pl) pl.name = name
    await _writeCache(cached)
    return true
  } catch {
    return false
  }
}
