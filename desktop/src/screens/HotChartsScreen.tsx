import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import api from '@common/services/api'
import type { Song } from '@common/types'
import { usePlayerStore } from '../stores/playerStore'
import {
  ArrowLeft, PlayCircle, Loader2, Flame,
} from 'lucide-react'
import { cn } from '../utils/cn'
import { showToast } from '../components/Toast'

type TabType = 'global' | 'platform'
type PeriodType = 'day' | 'week' | 'month' | 'all'

interface HotSong {
  rank: number
  song_name: string
  singers: string
  play_count: number
  source?: string
  song_identifier?: string
  cover_url?: string
  ext?: string
  duration_s?: number
}

const PLATFORM_TAGS = [
  '周杰伦', '抖音热歌', '华语', '欧美', '韩国', '日本',
  '粤语', '民谣', '摇滚', '电子', 'R&B', '说唱',
]

function formatPlayCount(count: number): string {
  if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
  return count.toString()
}

export default function HotChartsScreen() {
  const navigate = useNavigate()
  const playSong = usePlayerStore(s => s.playSong)

  const [tab, setTab] = useState<TabType>('global')
  const [period, setPeriod] = useState<PeriodType>('day')
  const [selectedTag, setSelectedTag] = useState('周杰伦')
  const [songs, setSongs] = useState<HotSong[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadCharts()
  }, [tab, period, selectedTag])

  const loadCharts = async () => {
    setLoading(true)
    try {
      if (tab === 'global') {
        const { data } = await api.get('/global-hot', { params: { period } })
        setSongs(Array.isArray(data) ? data.map((item: any, idx: number) => ({ ...item, rank: idx + 1, play_count: item.play_count || item.plays || 0 })) : [])
      } else {
        const { data } = await api.get('/hot-songs', { params: { keyword: selectedTag } })
        setSongs(Array.isArray(data) ? data.map((item: any, idx: number) => ({ ...item, rank: idx + 1 })) : [])
      }
    } catch (e) {
      console.error('Failed to load charts:', e)
      setSongs([])
    } finally {
      setLoading(false)
    }
  }

  const handlePlayAll = () => {
    if (songs.length === 0) return
    const playables: Song[] = songs
      .filter((s) => s.source && s.song_identifier)
      .map((s) => ({
        song_name: s.song_name,
        singers: s.singers,
        album: '',
        ext: s.ext || 'mp3',
        file_size: '',
        duration: '',
        duration_s: s.duration_s || 0,
        source: s.source!,
        song_identifier: s.song_identifier!,
        download_url: '',
        cover_url: s.cover_url || '',
        lyric: '',
        with_valid_download_url: false,
      }))
    if (playables.length > 0) {
      playSong(playables[0], playables)
    }
  }

  const periods: { key: PeriodType; label: string }[] = [
    { key: 'day', label: '日' },
    { key: 'week', label: '周' },
    { key: 'month', label: '月' },
    { key: 'all', label: '全部' },
  ]

  const handlePlay = (item: HotSong) => {
    if (!item.source || !item.song_identifier) {
      showToast('该歌曲暂无可播放版本', 'error')
      return
    }
    const song: Song = {
      song_name: item.song_name,
      singers: item.singers,
      album: '',
      ext: item.ext || 'mp3',
      file_size: '',
      duration: '',
      duration_s: item.duration_s || 0,
      source: item.source,
      song_identifier: item.song_identifier,
      download_url: '',
      cover_url: item.cover_url || '',
      lyric: '',
      with_valid_download_url: false,
    }
    showToast(`播放: ${song.song_name}`, 'info')
    playSong(song, songs.filter(s => s.source && s.song_identifier).map(s => ({
      song_name: s.song_name, singers: s.singers, album: '', ext: s.ext || 'mp3',
      file_size: '', duration: '', duration_s: s.duration_s || 0,
      source: s.source!, song_identifier: s.song_identifier!,
      download_url: '', cover_url: s.cover_url || '', lyric: '',
      with_valid_download_url: false,
    })))
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 text-text-secondary hover:text-text transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-text">热歌榜</h1>
        <div className="w-5" />
      </div>

      {/* Main / Platform tabs */}
      <div className="flex gap-2 px-4 py-3 bg-card flex-shrink-0">
        <button
          onClick={() => setTab('global')}
          className={cn(
            'flex-1 text-center py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'global' ? 'bg-primary text-white' : 'bg-border-light text-text-secondary'
          )}
        >
          全局热搜
        </button>
        <button
          onClick={() => setTab('platform')}
          className={cn(
            'flex-1 text-center py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'platform' ? 'bg-primary text-white' : 'bg-border-light text-text-secondary'
          )}
        >
          平台热歌
        </button>
      </div>

      {/* Period buttons (global) */}
      {tab === 'global' && (
        <div className="flex gap-2 px-4 py-2.5 bg-card border-b border-border flex-shrink-0">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm transition-colors',
                period === p.key
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'bg-border-light text-text-secondary'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Tag pills (platform) */}
      {tab === 'platform' && (
        <div className="flex gap-2 px-4 py-2.5 bg-card border-b border-border flex-shrink-0 overflow-x-auto">
          {PLATFORM_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 transition-colors',
                selectedTag === tag
                  ? 'bg-primary text-white font-medium'
                  : 'bg-border-light text-text-secondary'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Play all bar */}
      {songs.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-card border-b border-border-light flex-shrink-0">
          <PlayCircle size={18} className="text-primary" />
          <button onClick={handlePlayAll} className="text-sm text-primary font-semibold hover:opacity-80 transition-opacity">
            播放全部
          </button>
        </div>
      )}

      {/* Song list */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {songs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Flame size={64} className="text-border" />
              <p className="text-sm text-text-tertiary mt-3">暂无热歌数据</p>
            </div>
          ) : (
            songs.map((item) => (
              <button
                key={`${item.rank}_${item.song_name}`}
                className="w-full flex items-center px-4 py-3 bg-card border-b border-border-light hover:bg-border-light transition-colors text-left"
                onClick={() => handlePlay(item)}
              >
                {/* Rank badge */}
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center mr-3 flex-shrink-0',
                  item.rank <= 3 ? 'bg-primary' : 'bg-border-light'
                )}>
                  <span className={cn(
                    'text-sm font-bold',
                    item.rank <= 3 ? 'text-white' : 'text-text-tertiary'
                  )}>
                    {item.rank}
                  </span>
                </div>

                {/* Song info */}
                <div className="flex-1 min-w-0 mr-3">
                  <p className={cn(
                    'text-sm truncate',
                    item.rank <= 3 ? 'font-semibold text-primary' : 'text-text'
                  )}>
                    {item.song_name}
                  </p>
                  <p className="text-xs text-text-tertiary truncate">{item.singers}</p>
                </div>

                {/* Play count */}
                <span className="text-xs text-text-tertiary flex-shrink-0">{formatPlayCount(item.play_count)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
