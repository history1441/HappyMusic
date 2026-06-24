import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import api from '@common/services/api'
import type { Song } from '@common/types'
import {
  ArrowLeft, PlayCircle, RefreshCw, Play, Radio, Loader2,
} from 'lucide-react'
import { cn } from '../utils/cn'
import { showToast } from '../components/Toast'

type MoodType = 'happy' | 'sad' | 'relax' | 'sport' | 'focus' | 'romantic'

interface MoodConfig {
  key: MoodType
  emoji: string
  label: string
  description: string
  color: string
}

interface MoodSong {
  song_name: string
  singers: string
  source?: string
  song_identifier?: string
  cover_url?: string
  ext?: string
  duration_s?: number
}

const MOODS: MoodConfig[] = [
  { key: 'happy', emoji: '😊', label: '开心', description: '欢快的旋律', color: '#fbbf24' },
  { key: 'sad', emoji: '😢', label: '伤感', description: '安静治愈的歌声', color: '#60a5fa' },
  { key: 'relax', emoji: '😌', label: '放松', description: '舒缓身心的音乐', color: '#34d399' },
  { key: 'sport', emoji: '🏃', label: '运动', description: '充满能量的节拍', color: '#f97316' },
  { key: 'focus', emoji: '🎯', label: '专注', description: '提升注意力的音乐', color: '#8b5cf6' },
  { key: 'romantic', emoji: '💕', label: '浪漫', description: '甜蜜温馨的旋律', color: '#f472b6' },
]

export default function MoodRadioScreen() {
  const navigate = useNavigate()

  const [activeMood, setActiveMood] = useState<MoodType | null>(null)
  const [songs, setSongs] = useState<MoodSong[]>([])
  const [loading, setLoading] = useState(false)

  const loadMoodSongs = async (mood: MoodType) => {
    setActiveMood(mood)
    setLoading(true)
    try {
      const { data } = await api.get('/mood-radio', { params: { mood } })
      setSongs(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load mood songs:', e)
      setSongs([])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    if (activeMood) {
      loadMoodSongs(activeMood)
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
      showToast(`播放全部 ${playables.length} 首`, 'info')
    }
  }

  const handlePlay = (item: MoodSong) => {
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
  }

  const activeMoodConfig = activeMood ? MOODS.find((m) => m.key === activeMood) : null

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 text-text-secondary hover:text-text transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-text">心情电台</h1>
        <div className="w-5" />
      </div>

      {/* Mood grid */}
      <div className="flex flex-wrap gap-3 px-4 pt-4 pb-3 bg-card border-b border-border flex-shrink-0">
        {MOODS.map((mood) => {
          const isActive = activeMood === mood.key
          return (
            <button
              key={mood.key}
              onClick={() => loadMoodSongs(mood.key)}
              className={cn(
                'w-[30.5%] aspect-[1.2/1] rounded-2xl p-3 flex flex-col items-center justify-center transition-all',
                isActive ? 'border-2 shadow-sm' : 'border-2 border-transparent'
              )}
              style={{ backgroundColor: mood.color + '20', borderColor: isActive ? mood.color : 'transparent' }}
            >
              <span className="text-3xl mb-1">{mood.emoji}</span>
              <span className="text-sm font-semibold" style={{ color: mood.color }}>{mood.label}</span>
              <span className="text-[11px] text-text-tertiary text-center mt-0.5">{mood.description}</span>
            </button>
          )
        })}
      </div>

      {/* Results section */}
      {activeMood && (
        <>
          {/* Result header */}
          <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0">
            <span className="text-sm font-semibold text-text">
              {activeMoodConfig?.emoji} {activeMoodConfig?.label}电台
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePlayAll}
                className="flex items-center gap-1 text-sm text-primary font-medium hover:opacity-80 transition-opacity"
              >
                <PlayCircle size={18} />
                <span>播放全部</span>
              </button>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1 text-sm text-primary font-medium hover:opacity-80 transition-opacity"
              >
                <RefreshCw size={16} />
                <span>换一批</span>
              </button>
            </div>
          </div>

          {/* Song list */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {songs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <p className="text-sm text-text-tertiary">暂无推荐歌曲</p>
                </div>
              ) : (
                songs.map((item, idx) => (
                  <button
                    key={`${item.song_name}_${idx}`}
                    className="w-full flex items-center px-4 py-3 bg-card border-b border-border-light hover:bg-border-light transition-colors text-left"
                    onClick={() => handlePlay(item)}
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium text-text truncate">{item.song_name}</p>
                      <p className="text-xs text-text-tertiary truncate">{item.singers}</p>
                    </div>
                    <Play size={20} className="text-primary flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Hint when no mood selected */}
      {!activeMood && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Radio size={48} className="text-border" />
          <p className="text-sm text-text-tertiary mt-3">选择一种心情开始收听</p>
        </div>
      )}
    </div>
  )
}
