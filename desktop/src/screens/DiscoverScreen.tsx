import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import api from '@common/services/api'
import { usePlayerStore } from '../stores/playerStore'
import type { Song } from '@common/types'
import { formatDuration } from '@common/utils/format'
import { Play, ChevronLeft } from 'lucide-react'
import { cn } from '../utils/cn'

interface DetailData {
  name: string
  artist?: string
  total_plays: number
  unique_listeners?: number
  song_count: number
  songs: any[]
}

export default function DiscoverScreen() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const playSong = usePlayerStore(s => s.playSong)
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
    playSong({
      song_name: item.song_name, singers: item.singers, album: item.album || '',
      ext: item.ext || 'mp3', file_size: '', duration: '', duration_s: item.duration_s || 0,
      source: item.source || '', song_identifier: item.song_identifier || '',
      download_url: '', cover_url: item.cover_url || '', lyric: '', with_valid_download_url: false,
    } as Song, songs)
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-text-tertiary">加载中...</div>
  }

  if (!data || data.songs.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 text-text-tertiary">
        <div className="text-4xl">{type === 'artist' ? '🎤' : '💿'}</div>
        <div>暂无「{name}」的播放记录</div>
        <button onClick={() => navigate('/search')} className="px-5 py-2 bg-primary text-white rounded-lg text-sm">去搜索</button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-text-secondary hover:text-text mb-4 text-sm">
        <ChevronLeft size={18} /> 返回
      </button>

      <div className="bg-card border border-border rounded-xl p-6 mb-5 text-center">
        <h1 className="text-2xl font-bold mb-2">{data.name}</h1>
        {type === 'album' && data.artist && (
          <button onClick={() => navigate(`/discover?type=artist&name=${encodeURIComponent(data.artist as string)}`)} className="text-primary text-sm">
            {data.artist} ›
          </button>
        )}
        <div className="flex justify-center gap-10 mt-4">
          <div><div className="text-xl font-bold">{data.song_count}</div><div className="text-xs text-text-tertiary">曲目</div></div>
          <div><div className="text-xl font-bold">{data.total_plays}</div><div className="text-xs text-text-tertiary">总播放</div></div>
          {type === 'artist' && <div><div className="text-xl font-bold">{data.unique_listeners || 0}</div><div className="text-xs text-text-tertiary">听众</div></div>}
        </div>
        <button onClick={() => data.songs[0] && playItem(data.songs[0], data.songs)} className="mt-4 px-7 py-2 bg-primary text-white rounded-full font-medium inline-flex items-center gap-2">
          <Play size={16} fill="currentColor" /> 播放全部
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {data.songs.map((item, i) => (
          <div key={i} onClick={() => playItem(item, data.songs)} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-border-light border-b border-border last:border-0">
            <span className={cn('w-7 text-center font-bold', i < 3 ? 'text-primary' : 'text-text-tertiary')}>{i + 1}</span>
            {item.cover_url ? <img src={item.cover_url} alt="" className="w-11 h-11 rounded-lg object-cover" /> : <div className="w-11 h-11 rounded-lg bg-border" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{item.song_name}</div>
              <div className="text-xs text-text-tertiary truncate">{item.singers}{item.plays ? ` · 播放 ${item.plays}` : ''}</div>
            </div>
            <span className="text-xs text-text-tertiary tabular-nums">{formatDuration(item.duration_s || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
