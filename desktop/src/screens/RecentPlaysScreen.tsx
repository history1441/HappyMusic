import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, PlayCircle, Trash2, Clock, Loader2 } from 'lucide-react'
import { showToast } from '../components/Toast'
import { usePlayerStore } from '../stores/playerStore'
import { getRecentPlays, clearRecentPlays } from '../services/recentService'
import type { Song } from '@common/types'

function relativeTime(ts: string): string {
  const now = Date.now()
  const date = new Date(ts).getTime()
  const diff = now - date
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  if (days < 365) return `${Math.floor(days / 30)}个月前`
  return `${Math.floor(days / 365)}年前`
}

interface RecentPlay extends Song {
  played_at: string
}

export default function RecentPlaysScreen() {
  const navigate = useNavigate()
  const [plays, setPlays] = useState<RecentPlay[]>([])
  const [loading, setLoading] = useState(true)
  const playSong = usePlayerStore(s => s.playSong)

  const loadPlays = async () => {
    setLoading(true)
    try {
      const rows = await getRecentPlays(100)
      setPlays(rows as RecentPlay[])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadPlays() }, [])

  const handlePlayAll = () => {
    if (plays.length === 0) return
    playSong(plays[0], plays)
  }

  const handleClearHistory = async () => {
    if (!window.confirm('确定要清除所有播放历史吗？')) return
    try {
      await clearRecentPlays()
      setPlays([])
      showToast('已清除播放历史', 'success')
    } catch {
      showToast('清除失败', 'error')
    }
  }

  const handlePlaySong = (item: RecentPlay) => {
    playSong(item, plays)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1 text-text hover:text-primary transition-colors">
          <ArrowLeft size={22} />
        </button>
        <span className="text-lg font-bold">最近播放</span>
        <div className="w-6" />
      </div>

      {plays.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0">
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/30 px-4 py-2 rounded-full text-primary text-sm font-semibold hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-colors"
          >
            <PlayCircle size={18} />
            播放全部
          </button>
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1 px-3 py-2 text-red-500 text-sm hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            清除历史
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {plays.length > 0 ? (
          plays.map((item) => (
            <button
              key={`${item.source}_${item.song_identifier}`}
              onClick={() => handlePlaySong(item)}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-card border-b border-border-light hover:bg-border-light transition-colors text-left"
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-sm font-medium text-text truncate">{item.song_name}</p>
                <p className="text-xs text-text-secondary truncate">{item.singers}</p>
              </div>
              <span className="text-xs text-text-tertiary flex-shrink-0">{relativeTime(item.played_at)}</span>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center pt-24">
            <Clock size={56} className="text-border" />
            <p className="text-sm text-text-tertiary mt-3">暂无播放记录</p>
          </div>
        )}
      </div>
    </div>
  )
}
