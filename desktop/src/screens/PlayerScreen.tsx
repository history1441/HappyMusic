import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { usePlayerStore } from '../stores/playerStore'
import { addToFavorites, removeFromFavorites, isSongFavorited } from '../services/playlistService'
import { ChevronDown, Music, Heart } from 'lucide-react'
import { showToast } from '../components/Toast'
import { cn } from '../utils/cn'

type LyricMode = 'normal' | 'translation'

export default function PlayerScreen() {
  const navigate = useNavigate()
  const { currentSong, isPlaying, position, lyrics } = usePlayerStore()

  const [lyricMode, setLyricMode] = useState<LyricMode>('normal')
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  const [isFav, setIsFav] = useState(false)

  const lyricRef = useRef<HTMLDivElement>(null)

  // Check favorite status when song changes
  useEffect(() => {
    if (!currentSong) { setIsFav(false); return }
    isSongFavorited(currentSong.source, currentSong.song_identifier).then(setIsFav)
  }, [currentSong?.source, currentSong?.song_identifier])

  // Update current lyric index based on position
  useEffect(() => {
    if (lyrics.length === 0) return
    let idx = -1
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (lyrics[i].time <= position) { idx = i; break }
    }
    setCurrentLyricIndex(idx)
  }, [position, lyrics])

  // Auto-scroll lyrics
  useEffect(() => {
    if (lyricRef.current && currentLyricIndex >= 0) {
      const el = lyricRef.current.children[currentLyricIndex] as HTMLElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentLyricIndex])

  const cycleLyricMode = () => {
    setLyricMode(m => m === 'normal' ? 'translation' : 'normal')
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 text-text-secondary hover:text-text">
          <ChevronDown size={22} />
        </button>
        <div className="text-center">
          <p className="text-sm font-medium">{currentSong?.song_name || '未在播放'}</p>
          <p className="text-xs text-text-secondary">{currentSong?.singers || ''}</p>
        </div>
        <div className="w-8" />
      </div>

      {/* Main content: cover + lyrics side by side */}
      <div className="flex-1 flex items-center justify-center gap-12 px-8 py-6 overflow-hidden">
        {/* Vinyl disc */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <div
            className={cn(
              'w-64 h-64 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-2xl relative',
              isPlaying ? 'animate-spin-vinyl' : 'animate-spin-vinyl paused'
            )}
          >
            <div className="absolute inset-4 rounded-full border border-gray-700/30" />
            <div className="absolute inset-10 rounded-full border border-gray-700/20" />
            <div className="absolute inset-16 rounded-full border border-gray-700/30" />
            <div className="w-20 h-20 rounded-full bg-primary/80 flex items-center justify-center overflow-hidden">
              {currentSong?.cover_url ? (
                <img src={currentSong.cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Music size={28} className="text-white" />
              )}
            </div>
          </div>
          {currentSong && (
            <div className="mt-4 text-center max-w-[280px]">
              <p className="text-base font-semibold text-text truncate">{currentSong.song_name}</p>
              <p className="text-sm text-text-secondary truncate mt-0.5">{currentSong.singers}</p>
              {currentSong.album && (
                <p className="text-xs text-text-tertiary truncate mt-0.5">{currentSong.album}</p>
              )}
              <button
                onClick={async () => {
                  if (isFav) {
                    const ok = await removeFromFavorites(currentSong.source, currentSong.song_identifier)
                    if (ok) { setIsFav(false); showToast('已取消喜欢', 'success') }
                  } else {
                    const ok = await addToFavorites(currentSong)
                    if (ok) { setIsFav(true); showToast('已添加到喜欢', 'success') }
                  }
                }}
                className={cn('mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-colors', isFav ? 'text-primary bg-primary/10' : 'text-text-tertiary hover:text-primary bg-border')}
              >
                <Heart size={14} fill={isFav ? 'currentColor' : 'none'} />
                {isFav ? '已喜欢' : '喜欢'}
              </button>
            </div>
          )}
        </div>

        {/* Lyrics panel */}
        <div className="flex-1 max-w-lg h-full flex flex-col min-w-0">
          {/* Lyric mode toggle */}
          <div className="flex items-center justify-end mb-2 flex-shrink-0">
            <button
              onClick={cycleLyricMode}
              className="px-3 py-1 text-xs rounded-full border border-border text-text-secondary hover:text-text hover:border-primary/30 transition-colors"
            >
              {lyricMode === 'normal' ? '歌词' : '译文'}
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {lyrics.length > 0 ? (
              <div ref={lyricRef} className="h-full overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                {lyrics.map((line, i) => (
                  <p
                    key={i}
                    className={cn(
                      'text-sm transition-all duration-300 leading-relaxed',
                      i === currentLyricIndex
                        ? 'text-primary font-bold text-base'
                        : 'text-text-secondary hover:text-text'
                    )}
                  >
                    {line.text}
                    {lyricMode === 'translation' && line.translation && (
                      <span className="block text-xs text-text-tertiary mt-0.5">{line.translation}</span>
                    )}
                  </p>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-text-tertiary text-sm">
                {currentSong ? '暂无歌词' : '播放歌曲后显示歌词'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
