import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import api from '@common/services/api'
import { usePlayerStore } from '../stores/playerStore'
import type { PlaylistSong, Song } from '@common/types'
import { ArrowLeft, Play, X, Loader2, Disc3 } from 'lucide-react'
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

export default function PlaylistDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const name = (location.state as { name?: string })?.name || '歌单详情'
  const [songs, setSongs] = useState<PlaylistSong[]>([])
  const [loading, setLoading] = useState(true)
  const playSong = usePlayerStore(s => s.playSong)
  const currentSong = usePlayerStore(s => s.currentSong)
  const isPlaying = usePlayerStore(s => s.isPlaying)

  useEffect(() => { loadSongs() }, [id])

  const loadSongs = async () => {
    if (!id) return
    setLoading(true)
    try {
      const { data } = await api.get(`/playlists/${id}`)
      setSongs(data.songs || [])
    } catch {}
    setLoading(false)
  }

  const handleRemoveSong = async (song: PlaylistSong) => {
    if (!window.confirm(`确定从歌单移除 "${song.song_name}"？`)) return
    try {
      await api.delete(`/playlists/${id}/songs/${song.id}`)
      setSongs(prev => prev.filter(s => s.id !== song.id))
      showToast('已移除', 'success')
    } catch {
      showToast('移除失败', 'error')
    }
  }

  const handlePlay = (song: PlaylistSong) => {
    playSong(toSong(song), songs.map(toSong))
  }

  const handlePlayAll = () => {
    if (songs.length === 0) return
    playSong(toSong(songs[0]), songs.map(toSong))
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 text-text-secondary hover:text-text transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-text truncate px-2">{name}</h1>
        <div className="w-5" />
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-light bg-card flex-shrink-0">
        <span className="text-xs text-text-tertiary">{songs.length} 首</span>
        {songs.length > 0 && (
          <button onClick={handlePlayAll} className="flex items-center gap-1 px-3.5 py-1.5 bg-purple-50 rounded-full hover:bg-purple-100 transition-colors">
            <Play size={14} className="text-primary" fill="currentColor" />
            <span className="text-xs font-medium text-primary">播放全部</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : songs.length === 0 ? (
          <p className="text-center text-text-tertiary mt-10 text-sm">暂无歌曲</p>
        ) : (
          songs.map((item, index) => {
            const isActive = currentSong?.source === item.source && currentSong?.song_identifier === item.song_identifier
            return (
              <div
                key={item.id || index}
                className={cn(
                  'flex items-center px-4 py-2.5 border-b border-border-light hover:bg-border-light transition-colors cursor-pointer group',
                  isActive && 'bg-primary-light/50'
                )}
                onClick={() => handlePlay(item)}
              >
                <span className={cn('w-7 text-center text-sm flex-shrink-0', isActive ? 'text-primary font-medium' : 'text-text-tertiary')}>
                  {index + 1}
                </span>
                <div className="w-9 h-9 rounded bg-border flex items-center justify-center flex-shrink-0 overflow-hidden ml-1">
                  {item.cover_url ? (
                    <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Disc3 size={16} className="text-text-tertiary" />
                  )}
                </div>
                <div className="flex-1 ml-2.5 min-w-0">
                  <p className={cn('text-sm truncate', isActive ? 'text-primary font-medium' : 'text-text')}>{item.song_name}</p>
                  <p className="text-xs text-text-tertiary mt-0.5 truncate">{item.singers}</p>
                </div>
                {item.duration > 0 && (
                  <span className="text-xs text-text-tertiary tabular-nums mr-1">{formatDuration(item.duration)}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveSong(item) }}
                  className="p-1.5 text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  title="移除歌曲"
                >
                  <X size={16} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
