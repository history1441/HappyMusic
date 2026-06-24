import { useEffect, useState, useRef } from 'react'
import api from '../services/api'
import { Heart, ListMusic, Check } from 'lucide-react'
import type { Song } from '../types'

interface Props {
  song: Song
  onClose: () => void
  onAdded?: () => void
}

export default function AddToPlaylist({ song, onClose, onAdded }: Props) {
  const [playlists, setPlaylists] = useState<any[]>([])
  const [addedId, setAddedId] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get('/playlists').then(({ data }) => setPlaylists(data))
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleAdd = async (pl: any) => {
    try {
      await api.post(`/playlists/${pl.id}/songs`, {
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
      setAddedId(pl.id)
      onAdded?.()
      setTimeout(() => setAddedId(null), 1500)
    } catch (e: any) {
      if (e.response?.data?.detail?.includes('已存在')) {
        setAddedId(pl.id)
        setTimeout(() => setAddedId(null), 1000)
      }
    }
  }

  const favPlaylist = playlists.find((p: any) => p.is_favorite)
  const otherPlaylists = playlists.filter((p: any) => !p.is_favorite)

  return (
    <div ref={ref} style={{
      position: 'absolute', background: 'var(--card)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-lg)', zIndex: 100,
      minWidth: 200, maxHeight: 300, overflow: 'auto',
      padding: 4,
    }}>
      <div style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
        添加到歌单
      </div>
      {favPlaylist && (
        <button onClick={() => handleAdd(favPlaylist)} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', background: addedId === favPlaylist.id ? 'var(--accent-light)' : 'none',
          border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
          color: addedId === favPlaylist.id ? 'var(--accent)' : 'var(--text-primary)',
          fontSize: 13, textAlign: 'left',
        }}>
          {addedId === favPlaylist.id ? <Check size={14} style={{ color: '#10b981' }} /> : <Heart size={14} style={{ color: '#ef4444' }} />}
          我喜欢
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>{favPlaylist.song_count || 0}</span>
        </button>
      )}
      {otherPlaylists.map((pl: any) => (
        <button key={pl.id} onClick={() => handleAdd(pl)} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', background: addedId === pl.id ? 'var(--accent-light)' : 'none',
          border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
          color: addedId === pl.id ? 'var(--accent)' : 'var(--text-primary)',
          fontSize: 13, textAlign: 'left',
        }}>
          {addedId === pl.id ? <Check size={14} style={{ color: '#10b981' }} /> : <ListMusic size={14} style={{ color: 'var(--text-tertiary)' }} />}
          {pl.name}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>{pl.song_count || 0}</span>
        </button>
      ))}
    </div>
  )
}
