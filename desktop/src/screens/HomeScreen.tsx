import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import api from '@common/services/api'
import type { Song } from '@common/types'
import { formatDuration } from '@common/utils/format'
import { usePlayerStore } from '../stores/playerStore'
import {
  Music, Radio, Gamepad2, Sparkles, Flame,
  Clock, BarChart3, Download, FolderOpen,
  RefreshCw,
} from 'lucide-react'
import { showToast } from '../components/Toast'

const quickEntries = [
  { label: '心情电台', icon: Radio, path: '/mood-radio', color: 'bg-purple-500' },
  { label: '猜歌游戏', icon: Gamepad2, path: '/guess-game', color: 'bg-orange-500' },
  { label: 'AI推荐', icon: Sparkles, path: '/ai-recommend', color: 'bg-blue-500' },
  { label: '热门排行', icon: Flame, path: '/hot-charts', color: 'bg-red-500' },
  { label: '最近播放', icon: Clock, path: '/recent', color: 'bg-teal-500' },
  { label: '听歌统计', icon: BarChart3, path: '/stats', color: 'bg-indigo-500' },
  { label: '下载管理', icon: Download, path: '/downloads', color: 'bg-green-500' },
  { label: '本地音乐', icon: FolderOpen, path: '/local', color: 'bg-yellow-600' },
]

export default function HomeScreen() {
  const navigate = useNavigate()
  const playSong = usePlayerStore(s => s.playSong)
  const [hotSongs, setHotSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHotSongs()
  }, [])

  const loadHotSongs = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/search/hot', { params: { limit: 10 } })
      setHotSongs(data.songs || data || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="grid grid-cols-4 gap-3 mb-8">
        {quickEntries.map(entry => (
          <button
            key={entry.path}
            onClick={() => navigate(entry.path)}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all text-left"
          >
            <div className={`w-10 h-10 rounded-lg ${entry.color} flex items-center justify-center flex-shrink-0`}>
              <entry.icon size={20} className="text-white" />
            </div>
            <span className="text-sm font-medium">{entry.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">热门歌曲</h2>
        <button
          onClick={loadHotSongs}
          className="p-1.5 text-text-secondary hover:text-primary transition-colors"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : hotSongs.length > 0 ? (
        <div className="space-y-1">
          {hotSongs.map((song, index) => (
            <button
              key={`${song.source}-${song.song_identifier}`}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-border-light transition-colors text-left"
              onClick={() => playSong(song as Song, hotSongs)}
            >
              <span className={`w-6 text-center text-sm font-bold ${
                index < 3 ? 'text-primary' : 'text-text-tertiary'
              }`}>
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{song.song_name}</p>
                <p className="text-xs text-text-secondary truncate">
                  {song.singers} · {song.album}
                </p>
              </div>
              <span className="text-xs text-text-tertiary">
                {formatDuration(song.duration_s)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-text-tertiary text-sm">
          暂无热门歌曲
        </div>
      )}
    </div>
  )
}
