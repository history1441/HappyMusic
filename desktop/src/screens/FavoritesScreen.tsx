import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import api from '@common/services/api'
import { usePlayerStore } from '../stores/playerStore'
import { loadPlaylistsCached, refreshPlaylists, getFavPlaylistId, removeFromFavorites } from '../services/playlistService'
import type { PlaylistSong, Song } from '@common/types'
import { ArrowLeft, Heart, Loader2, Play, X, Disc3 } from 'lucide-react'
import { formatDuration } from '@common/utils/format'
import { showToast } from '../components/Toast'
import { cn } from '../utils/cn'

function toSong(ps: PlaylistSong): Song {
  return {
    song_name: ps.song_name, singers: ps.singers, album: ps.album,
    ext: ps.ext, file_size: '', duration: String(ps.duration),
    duration_s: ps.duration, source: ps.source, song_identifier: ps.song_identifier,
    download_url: '', cover_url: ps.cover_url || '', lyric: '',
    with_valid_download_url: false,
  }
}

export default function FavoritesScreen() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState<PlaylistSong[]>([])
  const [loading, setLoading] = useState(true)
  const playSong = usePlayerStore(s => s.playSong)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      await loadPlaylistsCached()
      const favId = getFavPlaylistId()
      if (favId) {
        const { data } = await api.get(`/playlists/${favId}`)
        setSongs(data.songs || [])
      }
    } catch {}
    setLoading(false)

    // Background refresh
    try {
      await refreshPlaylists()
      const favId = getFavPlaylistId()
      if (favId) {
        const { data } = await api.get(`/playlists/${favId}`)
        setSongs(data.songs || [])
      }
    } catch {}
  }

  const handlePlay = (song: PlaylistSong) => {
    playSong(toSong(song), songs.map(toSong))
  }

  const handlePlayAll = () => {
    if (songs.length === 0) return
    playSong(toSong(songs[0]), songs.map(toSong))
  }

  const handleUnlike = async (song: PlaylistSong) => {
    const ok = await removeFromFavorites(song.source, song.song_identifier)
    if (ok) {
      setSongs(prev => prev.filter(s => s.id !== song.id))
      showToast('已取消喜欢', 'success')
    }
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 text-text-secondary hover:text-text transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-text">我喜欢的</h1>
        <div className="w-5" />
      </div>

      {/* Action bar */}
      {songs.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-light bg-card flex-shrink-0">
          <span className="text-xs text-text-tertiary">{songs.length} 首</span>
          <button onClick={handlePlayAll} className="flex items-center gap-1 px-3.5 py-1.5 bg-red-50 rounded-full hover:bg-red-100 transition-colors">
            <Play size={14} className="text-primary" fill="currentColor" />
            <span className="text-xs font-medium text-primary">播放全部</span>
          </button>
        </div>
      )}

      {/* Song list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        ) : songs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center pt-24">
            <Heart size={56} className="text-border" />
            <p className="text-sm text-text-tertiary mt-3">暂无收藏歌曲</p>
            <p className="text-xs text-text-tertiary/60 mt-1">播放歌曲时点击心形按钮收藏</p>
          </div>
        ) : (
          songs.map((item, index) => (
            <div
              key={item.id || index}
              className="flex items-center px-4 py-2.5 bg-card border-b border-border-light hover:bg-border-light transition-colors cursor-pointer group"
              onClick={() => handlePlay(item)}
            >
              <span className="w-7 text-center text-sm text-text-tertiary flex-shrink-0">{index + 1}</span>
              <div className="w-9 h-9 rounded bg-border flex items-center justify-center flex-shrink-0 overflow-hidden ml-1">
                {item.cover_url ? (
                  <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Disc3 size={16} className="text-text-tertiary" />
                )}
              </div>
              <div className="flex-1 ml-2.5 min-w-0">
                <p className="text-sm text-text truncate">{item.song_name}</p>
                <p className="text-xs text-text-tertiary mt-0.5 truncate">{item.singers}</p>
              </div>
              {item.duration > 0 && (
                <span className="text-xs text-text-tertiary tabular-nums mr-1">{formatDuration(item.duration)}</span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleUnlike(item) }}
                className="p-1.5 text-primary hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
                title="取消喜欢"
              >
                <Heart size={16} fill="currentColor" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
