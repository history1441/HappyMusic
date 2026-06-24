import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Music, Play, Pause, Download } from 'lucide-react'
import { formatDuration } from '@common/utils/format'
import { showToast } from '../components/Toast'
import { usePlayerStore } from '../stores/playerStore'

const MAX_DURATION = 30

export default function RingtoneMakerScreen() {
  const navigate = useNavigate()
  const { currentSong, duration, seekTo, togglePlay } = usePlayerStore()
  const isPlaying = usePlayerStore(s => s.isPlaying)

  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(Math.min(MAX_DURATION, duration || MAX_DURATION))
  const [isPreviewing, setIsPreviewing] = useState(false)

  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (duration > 0) {
      setEndTime(Math.min(MAX_DURATION, duration))
    }
  }, [duration])

  useEffect(() => {
    return () => { stopPreview() }
  }, [])

  const stopPreview = () => {
    if (previewIntervalRef.current) {
      clearInterval(previewIntervalRef.current)
      previewIntervalRef.current = null
    }
    setIsPreviewing(false)
  }

  const playPreview = async () => {
    if (!currentSong) return
    if (isPreviewing) {
      stopPreview()
      return
    }

    await seekTo(startTime)
    if (!isPlaying) togglePlay()
    setIsPreviewing(true)

    previewIntervalRef.current = setInterval(() => {
      const pos = usePlayerStore.getState().position
      if (pos >= endTime) {
        stopPreview()
        usePlayerStore.getState().togglePlay()
      }
    }, 200)
  }

  const handleStartTimeChange = (value: number) => {
    setStartTime(value)
    if (value >= endTime) {
      setEndTime(Math.min(value + MAX_DURATION, duration || value + MAX_DURATION))
    }
    if (endTime - value > MAX_DURATION) {
      setEndTime(value + MAX_DURATION)
    }
  }

  const handleEndTimeChange = (value: number) => {
    if (value - startTime > MAX_DURATION) {
      setEndTime(startTime + MAX_DURATION)
    } else {
      setEndTime(value)
    }
  }

  const handleExport = () => {
    showToast('功能开发中', 'info')
  }

  const selectedDuration = endTime - startTime
  const sliderMax = duration || 100
  const maxEnd = Math.min(startTime + MAX_DURATION, duration || startTime + MAX_DURATION)

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1 text-text hover:text-primary transition-colors">
          <ArrowLeft size={22} />
        </button>
        <span className="text-lg font-bold">铃声制作</span>
        <div className="w-6" />
      </div>

      {!currentSong ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <Music size={56} className="text-border mb-4" />
          <p className="text-lg font-semibold text-text-secondary">请先播放一首歌</p>
          <p className="text-sm text-text-tertiary mt-1">返回并播放歌曲后即可制作铃声</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 mx-4 mt-4 p-3.5 bg-card border border-border rounded-xl shadow-sm">
            <div className="w-11 h-11 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center flex-shrink-0">
              <Music size={22} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text truncate">{currentSong.song_name}</p>
              <p className="text-xs text-text-secondary truncate">{currentSong.singers}</p>
            </div>
          </div>

          <div className="mt-6 px-4">
            <h2 className="text-base font-semibold text-text mb-1">选择片段</h2>
            <p className="text-xs text-text-secondary mb-4">最长 {MAX_DURATION} 秒</p>

            <div className="mb-5">
              <div className="relative h-8 bg-border rounded-md overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-primary/30 rounded-md"
                  style={{
                    left: `${(startTime / sliderMax) * 100}%`,
                    width: `${((endTime - startTime) / sliderMax) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-text-secondary font-medium w-9">开始</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, sliderMax - 1)}
                step={0.1}
                value={startTime}
                onChange={(e) => handleStartTimeChange(Number(e.target.value))}
                className="flex-1 h-2 appearance-none bg-border rounded-full outline-none
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
              />
              <span className="text-xs text-text font-medium w-11 text-right">{formatDuration(startTime)}</span>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-text-secondary font-medium w-9">结束</span>
              <input
                type="range"
                min={Math.max(0, startTime + 1)}
                max={maxEnd}
                step={0.1}
                value={endTime}
                onChange={(e) => handleEndTimeChange(Number(e.target.value))}
                className="flex-1 h-2 appearance-none bg-border rounded-full outline-none
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
              />
              <span className="text-xs text-text font-medium w-11 text-right">{formatDuration(endTime)}</span>
            </div>

            <div className="flex flex-col items-center mb-2">
              <p className="text-sm font-semibold text-primary">已选择: {formatDuration(selectedDuration)}</p>
              {selectedDuration > MAX_DURATION && (
                <p className="text-xs text-amber-500 mt-1">铃声不能超过 {MAX_DURATION} 秒</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 px-4 mt-6 mb-10">
            <button
              onClick={playPreview}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-semibold transition-colors ${
                isPreviewing ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {isPreviewing ? <Pause size={20} /> : <Play size={20} />}
              {isPreviewing ? '停止预览' : '预览片段'}
            </button>
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors"
            >
              <Download size={20} />
              导出铃声
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
