import { useNavigate } from 'react-router'
import { useState, useRef } from 'react'
import { Play, Pause, SkipForward, SkipBack, Repeat, Shuffle, Repeat1, Disc3, Volume2, Volume1, VolumeX } from 'lucide-react'
import { usePlayerStore } from '../stores/playerStore'
import { formatDuration } from '@common/utils/format'
import { cn } from '../utils/cn'

export default function MiniPlayer() {
  const navigate = useNavigate()
  const { currentSong, isPlaying, position, duration, playMode, isBuffering, volume,
    togglePlay, next, prev, setPlayMode, seekTo, setVolume } = usePlayerStore()
  const [showVolume, setShowVolume] = useState(false)
  const volumeRef = useRef<HTMLDivElement>(null)

  if (!currentSong) {
    return (
      <div className="h-[72px] flex-shrink-0 border-t border-border bg-card flex items-center px-4 gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-lg bg-border flex items-center justify-center flex-shrink-0">
            <Disc3 size={20} className="text-text-tertiary" />
          </div>
          <p className="text-sm text-text-tertiary">未在播放</p>
        </div>
      </div>
    )
  }

  const progress = duration > 0 ? (position / duration) * 100 : 0
  const playModeIcon = playMode === 'random' ? Shuffle : playMode === 'single' ? Repeat1 : Repeat
  const nextPlayMode: Record<string, import('@common/types').PlayMode> = {
    sequence: 'random', random: 'single', single: 'sequence',
  }

  const volumePercent = Math.round(volume * 100)
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    seekTo(ratio * duration)
  }

  function handleVolumeClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setVolume(ratio)
  }

  function cycleMute() {
    setVolume(volume > 0 ? 0 : 1)
  }

  return (
    <div className="h-[72px] flex-shrink-0 border-t border-border bg-card flex flex-col">
      {/* Progress bar */}
      <div
        className="h-1 bg-border cursor-pointer group"
        onClick={handleProgressClick}
      >
        <div
          className="h-full bg-primary transition-all duration-300 relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex-1 flex items-center px-4 gap-4">
        {/* Song info */}
        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={() => navigate('/player')}
        >
          <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-border">
            {currentSong.cover_url ? (
              <img src={currentSong.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Disc3 size={20} className="text-text-tertiary" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm truncate text-text">{currentSong.song_name}</p>
            <p className="text-xs truncate text-text-tertiary">{currentSong.singers}</p>
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPlayMode(nextPlayMode[playMode])}
            className={cn(
              'p-1.5 rounded-full transition-colors',
              playMode !== 'sequence' ? 'text-primary' : 'text-text-tertiary hover:text-text'
            )}
            title={playMode === 'sequence' ? '顺序播放' : playMode === 'random' ? '随机播放' : '单曲循环'}
          >
            {(() => { const Icon = playModeIcon; return <Icon size={16} /> })()}
          </button>
          <button onClick={prev} className="p-1.5 text-text-secondary hover:text-text transition-colors">
            <SkipBack size={18} />
          </button>
          <button
            onClick={togglePlay}
            disabled={isBuffering}
            className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {isBuffering ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause size={18} />
            ) : (
              <Play size={18} className="ml-0.5" />
            )}
          </button>
          <button onClick={next} className="p-1.5 text-text-secondary hover:text-text transition-colors">
            <SkipForward size={18} />
          </button>
        </div>

        {/* Volume + Time */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={volumeRef}>
            <button
              onClick={() => setShowVolume(!showVolume)}
              className="p-1 text-text-secondary hover:text-text transition-colors"
              title={`音量: ${volumePercent}%`}
            >
              <VolumeIcon size={18} />
            </button>
            {showVolume && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowVolume(false)} />
                <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-lg shadow-lg p-3 z-50 w-48"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    <button onClick={cycleMute} className="p-0.5 text-text-secondary hover:text-text transition-colors flex-shrink-0">
                      <VolumeIcon size={16} />
                    </button>
                    <div
                      className="flex-1 h-1.5 bg-border rounded-full cursor-pointer group"
                      onClick={handleVolumeClick}
                    >
                      <div
                        className="h-full bg-primary rounded-full relative transition-all"
                        style={{ width: `${volumePercent}%` }}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <span className="text-[11px] text-text-tertiary tabular-nums w-7 text-right">{volumePercent}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="text-xs text-text-tertiary tabular-nums w-24 text-right">
            {formatDuration(position)} / {formatDuration(duration)}
          </div>
        </div>
      </div>
    </div>
  )
}
