import { useState, useEffect, useRef, useCallback } from 'react'
import { Languages, Type, Image } from 'lucide-react'

interface LrcLine {
  time: number
  text: string
  translation?: string
}

function parseLrc(lrc: string): LrcLine[] {
  const lines = lrc.split('\n')
  const result: LrcLine[] = []
  const timeRegex = /\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\]/g
  const translations = new Map<string, string>()

  for (const line of lines) {
    const trMatch = line.match(/\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\]\/\/(.+)/)
    if (trMatch) {
      const min = parseInt(trMatch[1])
      const sec = parseInt(trMatch[2])
      const ms = trMatch[3] ? parseInt(trMatch[3].padEnd(3, '0')) : 0
      translations.set(`${min}:${sec}:${ms}`, trMatch[4].trim())
    }
  }

  for (const line of lines) {
    if (line.includes('//')) continue
    const times: number[] = []
    let match: RegExpExecArray | null
    timeRegex.lastIndex = 0
    while ((match = timeRegex.exec(line)) !== null) {
      times.push(parseInt(match[1]) * 60 + parseInt(match[2]) + (match[3] ? parseInt(match[3].padEnd(3, '0')) / 1000 : 0))
    }
    const text = line.replace(/\[.*?\]/g, '').trim()
    if (text) {
      for (const t of times) {
        const key = `${Math.floor(t / 60)}:${Math.floor(t % 60)}:${Math.floor((t % 1) * 1000)}`
        result.push({ time: t, text, translation: translations.get(key) })
      }
    }
  }
  result.sort((a, b) => a.time - b.time)
  return result
}

type DisplayMode = 'normal' | 'karaoke' | 'translation'

interface Props {
  lyric: string
  currentTime: number
  onSeek?: (time: number) => void
  onBack?: () => void
}

export default function Lyrics({ lyric, currentTime, onSeek, onBack }: Props) {
  const [lines, setLines] = useState<LrcLine[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const [mode, setMode] = useState<DisplayMode>('normal')
  const containerRef = useRef<HTMLDivElement>(null)
  const isUserScrolling = useRef(false)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Drag to seek
  const isDragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartTime = useRef(0)

  useEffect(() => {
    if (lyric) setLines(parseLrc(lyric))
    else setLines([])
  }, [lyric])

  useEffect(() => {
    if (lines.length === 0) return
    let idx = -1
    for (let i = lines.length - 1; i >= 0; i--) {
      if (currentTime >= lines[i].time) { idx = i; break }
    }
    if (idx !== activeIdx) {
      setActiveIdx(idx)
      if (!isUserScrolling.current && containerRef.current && idx >= 0) {
        const el = containerRef.current.children[idx] as HTMLElement
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [currentTime, lines])

  const handleScroll = () => {
    isUserScrolling.current = true
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => { isUserScrolling.current = false }, 3000)
  }

  const handleLineClick = (line: LrcLine) => {
    if (onSeek) onSeek(line.time)
  }

  const cycleMode = () => {
    const modes: DisplayMode[] = ['normal', 'karaoke', 'translation']
    setMode(modes[(modes.indexOf(mode) + 1) % modes.length])
  }

  // Calculate progress for a line (0-1 based on time within the line)
  const getLineProgress = (idx: number): number => {
    if (idx < 0 || idx >= lines.length) return 0
    const line = lines[idx]
    const nextTime = idx < lines.length - 1 ? lines[idx + 1].time : line.time + 5
    const duration = nextTime - line.time
    if (duration <= 0) return 1
    return Math.min(1, Math.max(0, (currentTime - line.time) / duration))
  }

  // Drag to seek handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (lines.length === 0) return
    isDragging.current = true
    dragStartY.current = e.clientY
    dragStartTime.current = currentTime
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [lines.length, currentTime])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !containerRef.current || lines.length === 0) return
    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const scrollableHeight = container.scrollHeight - rect.height
    if (scrollableHeight <= 0) return
    // Map scroll position to time
    const scrollRatio = container.scrollTop / scrollableHeight
    const lastLine = lines[lines.length - 1]
    const seekTime = scrollRatio * lastLine.time
    if (onSeek) onSeek(seekTime)
  }, [lines, onSeek])

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
  }, [])

  if (lines.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 15, flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 32, opacity: 0.4 }}>🎵</span>
        暂无歌词
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Mode toggle + back to cover */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
        <button onClick={cycleMode} style={{
          padding: '4px 12px', background: 'rgba(255,255,255,0.1)',
          border: 'none', borderRadius: 12, color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {mode === 'normal' && <Type size={10} />}
          {mode === 'karaoke' && <Type size={10} />}
          {mode === 'translation' && <Languages size={10} />}
          {mode === 'normal' ? '普通' : mode === 'karaoke' ? '逐字' : '双语'}
        </button>
        {onBack && (
          <button onClick={onBack} style={{
            padding: '4px 12px', background: 'rgba(255,255,255,0.1)',
            border: 'none', borderRadius: 12, color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Image size={10} /> 返回封面
          </button>
        )}
      </div>

      {/* Lyrics container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          flex: 1, overflow: 'auto', padding: '40px 24px',
          maskImage: 'linear-gradient(transparent 0%, black 15%, black 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(transparent 0%, black 15%, black 85%, transparent 100%)',
          touchAction: 'pan-y',
        }}
      >
        {lines.map((line, idx) => {
          const isActive = idx === activeIdx
          const progress = getLineProgress(idx)

          return (
            <div
              key={idx}
              onClick={() => handleLineClick(line)}
              style={{ padding: '10px 0', textAlign: 'center', cursor: onSeek ? 'pointer' : 'default' }}
            >
              {mode === 'karaoke' && isActive ? (
                /* Per-character karaoke highlight */
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.8 }}>
                  {line.text.split('').map((char, ci) => {
                    const charStart = ci / line.text.length
                    const charEnd = (ci + 1) / line.text.length
                    const isHighlighted = progress >= charStart
                    const charProgress = progress >= charEnd ? 1 : progress > charStart ? (progress - charStart) / (charEnd - charStart) : 0

                    return (
                      <span key={ci} style={{
                        color: isHighlighted ? '#fff' : 'rgba(255,255,255,0.3)',
                        textShadow: isHighlighted ? `0 0 ${8 + charProgress * 12}px rgba(255,255,255,${0.3 + charProgress * 0.4})` : 'none',
                        transition: 'color 0.05s, text-shadow 0.05s',
                        display: 'inline-block',
                        transform: isHighlighted && charProgress > 0.5 ? `scale(${1 + charProgress * 0.05})` : 'scale(1)',
                      }}>
                        {char}
                      </span>
                    )
                  })}
                </div>
              ) : mode === 'karaoke' && idx < activeIdx ? (
                /* Past lines in karaoke mode */
                <div style={{ fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,0.25)', lineHeight: 1.8 }}>
                  {line.text}
                </div>
              ) : (
                <div style={{
                  fontSize: isActive ? 18 : 15,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.3s ease',
                  lineHeight: 1.8,
                  textShadow: isActive ? '0 0 20px rgba(255,255,255,0.2)' : 'none',
                }}>
                  {line.text}
                </div>
              )}
              {mode === 'translation' && line.translation && (
                <div style={{
                  fontSize: isActive ? 14 : 12,
                  color: isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)',
                  transition: 'all 0.3s ease', marginTop: 2,
                }}>
                  {line.translation}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
