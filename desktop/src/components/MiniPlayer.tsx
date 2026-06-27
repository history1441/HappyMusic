import { useNavigate } from 'react-router'
import { useState, useRef, useEffect } from 'react'
import { Play, Pause, SkipForward, SkipBack, Repeat, Shuffle, Repeat1, Disc3, Volume2, Volume1, VolumeX, Timer, Gauge, Pin, Minimize2, Captions, Sliders } from 'lucide-react'
import { usePlayerStore } from '../stores/playerStore'
import { useWindowStore } from '../stores/windowStore'
import Equalizer from './Equalizer'
import { formatDuration } from '@common/utils/format'
import {
  SPEED_PRESETS, formatSpeed,
  TIMER_PRESETS, formatRemaining,
} from '@common/utils/playerControls'
import { cn } from '../utils/cn'

export default function MiniPlayer() {
  const navigate = useNavigate()
  const { currentSong, isPlaying, position, duration, playMode, isBuffering, volume, rate, abLoop, timerEndTime,
    togglePlay, next, prev, setPlayMode, seekTo, setVolume, setRate, toggleAbPoint, clearAb, setTimer } = usePlayerStore()
  const { alwaysOnTop, toggleAlwaysOnTop, enterMini, lyricsOverlayOn, toggleLyricsOverlay } = useWindowStore()
  const [showVolume, setShowVolume] = useState(false)
  const [showSpeed, setShowSpeed] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [showEq, setShowEq] = useState(false)
  const [, setNow] = useState(0)
  const volumeRef = useRef<HTMLDivElement>(null)

  // 定时倒计时刷新(500ms)
  useEffect(() => {
    if (!timerEndTime) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [timerEndTime])

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

        {/* 工具组:倍速 / 定时 / AB复读 */}
        <div className="flex items-center gap-1">
          {/* 倍速 */}
          <div className="relative">
            <button
              onClick={() => { setShowSpeed(!showSpeed); setShowVolume(false); setShowTimer(false) }}
              className={cn('px-2 py-1 rounded-full text-xs transition-colors', rate !== 1 ? 'text-primary bg-primary/10' : 'text-text-tertiary hover:text-text')}
              title="播放倍速"
            >
              <span className="tabular-nums">{formatSpeed(rate)}</span>
            </button>
            {showSpeed && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSpeed(false)} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border border-border rounded-lg shadow-lg p-2 z-50 flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
                  {SPEED_PRESETS.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setRate(s); setShowSpeed(false) }}
                      className={cn('px-3 py-1.5 rounded text-xs tabular-nums hover:bg-border text-left', Math.abs(s - rate) < 0.01 ? 'text-primary font-semibold' : 'text-text-secondary')}
                    >
                      {formatSpeed(s)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 定时关闭 */}
          <div className="relative">
            <button
              onClick={() => { setShowTimer(!showTimer); setShowVolume(false); setShowSpeed(false) }}
              className={cn('p-1.5 rounded-full transition-colors', timerEndTime ? 'text-primary bg-primary/10' : 'text-text-tertiary hover:text-text')}
              title={timerEndTime ? `定时关闭 ${formatRemaining(timerEndTime) || ''}` : '定时关闭'}
            >
              <Timer size={16} />
            </button>
            {timerEndTime && (
              <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-primary text-white rounded px-1 leading-tight tabular-nums">{formatRemaining(timerEndTime)}</span>
            )}
            {showTimer && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTimer(false)} />
                <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-lg shadow-lg p-2 z-50 grid grid-cols-3 gap-1 w-52" onClick={e => e.stopPropagation()}>
                  {TIMER_PRESETS.map((m) => (
                    <button
                      key={m}
                      onClick={() => { setTimer(m); setShowTimer(false) }}
                      className="px-2 py-1.5 rounded text-xs hover:bg-border text-text-secondary"
                    >
                      {m}分
                    </button>
                  ))}
                  <button
                    onClick={() => { setTimer(null); setShowTimer(false) }}
                    className="col-span-3 px-2 py-1.5 rounded text-xs hover:bg-border text-text-tertiary border-t border-border mt-1"
                  >
                    取消定时
                  </button>
                </div>
              </>
            )}
          </div>

          {/* AB复读 */}
          <button
            onClick={() => toggleAbPoint()}
            onDoubleClick={() => clearAb()}
            className={cn('p-1.5 rounded-full transition-colors', abLoop.a != null ? 'text-primary bg-primary/10' : 'text-text-tertiary hover:text-text')}
            title={abLoop.b != null ? `AB复读 ${formatDuration(abLoop.a || 0)}~${formatDuration(abLoop.b)}` : abLoop.a != null ? '再按设B点(双击清除)' : 'AB复读(按设A点)'}
          >
            <Repeat size={16} />
          </button>

          {/* 均衡器 */}
          <button
            onClick={() => setShowEq(true)}
            className="p-1.5 rounded-full text-text-tertiary hover:text-text transition-colors"
            title="均衡器"
          >
            <Sliders size={16} />
          </button>
        </div>

        {/* 窗口控制:置顶 + 迷你模式 */}
        <div className="flex items-center">
          <button
            onClick={toggleAlwaysOnTop}
            title={alwaysOnTop ? '取消置顶' : '窗口置顶'}
            className={cn('p-1.5 rounded-full transition-colors', alwaysOnTop ? 'text-primary' : 'text-text-tertiary hover:text-text')}
          >
            <Pin size={16} fill={alwaysOnTop ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={enterMini}
            title="迷你播放器(置顶小窗)"
            className="p-1.5 rounded-full text-text-tertiary hover:text-text transition-colors"
          >
            <Minimize2 size={16} />
          </button>
          <button
            onClick={toggleLyricsOverlay}
            title={lyricsOverlayOn ? '关闭桌面歌词' : '桌面歌词(悬浮窗)'}
            className={cn('p-1.5 rounded-full transition-colors', lyricsOverlayOn ? 'text-primary' : 'text-text-tertiary hover:text-text')}
          >
            <Captions size={16} />
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
      <Equalizer show={showEq} onClose={() => setShowEq(false)} />
    </div>
  )
}
