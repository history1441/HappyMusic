import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useIsMobile } from '../hooks/useBreakpoint'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import type { Song } from '../types'
import { ChevronLeft, Play } from 'lucide-react'

interface DetailData {
  name: string
  artist?: string
  total_plays: number
  unique_listeners?: number
  song_count: number
  songs: any[]
}

export default function Discover() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const play = usePlayerStore.getState().play
  const type = (params.get('type') || 'artist') as 'artist' | 'album'
  const name = params.get('name') || ''

  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/discover/${type}`, { params: { name, limit: 50 } })
      .then(({ data }) => setData(data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [type, name])

  const playItem = (item: any, list: any[]) => {
    const songs: Song[] = list.map((s) => ({
      song_name: s.song_name, singers: s.singers, album: s.album || '',
      ext: s.ext || 'mp3', file_size: '', duration: '', duration_s: s.duration_s || 0,
      source: s.source || '', song_identifier: s.song_identifier || '',
      download_url: '', cover_url: s.cover_url || '', lyric: '', with_valid_download_url: false,
    }))
    play({
      song_name: item.song_name, singers: item.singers, album: item.album || '',
      ext: item.ext || 'mp3', file_size: '', duration: '', duration_s: item.duration_s || 0,
      source: item.source || '', song_identifier: item.song_identifier || '',
      download_url: '', cover_url: item.cover_url || '', lyric: '', with_valid_download_url: false,
    } as Song, songs)
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120 }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, fontSize: 14 }}>
        <ChevronLeft size={18} /> 返回
      </button>

      {loading ? (
        <div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 20, textAlign: 'center' }}>
            <div style={{ height: 28, width: 180, margin: '0 auto 12px', background: 'var(--bg-tertiary)', borderRadius: 6, opacity: 0.6 }} className="hm-skeleton" />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 16 }}>
              {[0, 1, 2].map((i) => <div key={i}><div style={{ height: 22, width: 40, background: 'var(--bg-tertiary)', borderRadius: 4, opacity: 0.6, margin: '0 auto' }} className="hm-skeleton" /><div style={{ height: 12, width: 30, background: 'var(--bg-tertiary)', borderRadius: 4, opacity: 0.4, margin: '4px auto 0' }} className="hm-skeleton" /></div>)}
            </div>
          </div>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-tertiary)', opacity: 0.6 }} className="hm-skeleton" />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 14, width: '40%', background: 'var(--bg-tertiary)', borderRadius: 4, opacity: 0.6, marginBottom: 6 }} className="hm-skeleton" />
                  <div style={{ height: 11, width: '25%', background: 'var(--bg-tertiary)', borderRadius: 4, opacity: 0.4 }} className="hm-skeleton" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !data || data.songs.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>{type === 'artist' ? '🎤' : '💿'}</div>
          暂无「{name}」的播放记录
          <div style={{ marginTop: 16 }}>
            <button onClick={() => navigate('/')} style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>去搜索</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 20, textAlign: 'center' }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>{data.name}</h1>
            {type === 'album' && data.artist && (
              <button onClick={() => navigate(`/discover?type=artist&name=${encodeURIComponent(data.artist as string)}`)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14 }}>
                {data.artist} ›
              </button>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 16 }}>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{data.song_count}</div><div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>曲目</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{data.total_plays}</div><div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>总播放</div></div>
              {type === 'artist' && <div><div style={{ fontSize: 22, fontWeight: 700 }}>{data.unique_listeners || 0}</div><div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>听众</div></div>}
            </div>
            <button onClick={() => data.songs[0] && playItem(data.songs[0], data.songs)} style={{ marginTop: 16, padding: '10px 28px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 22, cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Play size={16} fill="currentColor" /> 播放全部
            </button>
          </div>

          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {data.songs.map((item, i) => (
              <div key={i} onClick={() => playItem(item, data.songs)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', borderBottom: i < data.songs.length - 1 ? '1px solid var(--border)' : 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ width: 28, textAlign: 'center', fontWeight: 700, color: i < 3 ? 'var(--accent)' : 'var(--text-tertiary)' }}>{i + 1}</span>
                {item.cover_url ? <img src={item.cover_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-tertiary)' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.song_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{item.singers}{item.plays ? ` · 播放 ${item.plays}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
