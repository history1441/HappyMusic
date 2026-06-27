import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayerStore } from '../../stores/playerStore'
import { useIsMobile } from '../../hooks/useBreakpoint'
import Lyrics from './Lyrics'
import AudioVisualizer from './AudioVisualizer'
import ShareCard from './ShareCard'
import AddToPlaylist from '../AddToPlaylist'
import api from '../../services/api'
import {
  Play, Pause, SkipBack, SkipForward, ChevronDown,
  Repeat, Shuffle, Repeat1, Music2, Timer, X, Mic2, Share2,
  Heart, ListPlus, Sparkles, Brain, Gauge,
} from 'lucide-react'
import { SPEED_PRESETS, formatSpeed } from '@common/utils/playerControls'

export default function FullPlayer() {
  const navigate = useNavigate()
  const {
    currentSong, isPlaying, showFullPlayer,
    togglePlay, next, prev,
    setShowFullPlayer, setTimer, timerMinutes, checkTimer, setPlayMode, playMode,
    rate, setRate, abLoop, toggleAbPoint, clearAb,
  } = usePlayerStore()

  const [showTimer, setShowTimer] = useState(false)
  const [showSpeed, setShowSpeed] = useState(false)
  const [remaining, setRemaining] = useState<string | null>(null)
  const [dominantColor, setDominantColor] = useState<string>('var(--bg-primary)')
  const [showLyrics, setShowLyrics] = useState(false)
  const [showShareCard, setShowShareCard] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [isFav, setIsFav] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [lyric, setLyric] = useState('')
  const [aiResult, setAiResult] = useState<{ mood: string; score: number; commentary: string; emoji: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    const interval = setInterval(() => {
      checkTimer()
      const store = usePlayerStore.getState()
      if (store.timerEndTime) {
        const diff = Math.max(0, store.timerEndTime - Date.now())
        const m = Math.floor(diff / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        setRemaining(`${m}:${s.toString().padStart(2, '0')}`)
      } else {
        setRemaining(null)
      }
      const audio = document.querySelector('audio') as HTMLAudioElement | null
      if (audio) setCurrentTime(audio.currentTime)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setAiResult(null)
    if (!currentSong) { setLyric(''); return }
    if (currentSong.lyric && /\[\d{1,2}:\d{2}/.test(currentSong.lyric)) { setLyric(currentSong.lyric); return }
    import('../../services/api').then(({ default: api }) => {
      api.get('/lyrics', {
        params: { song_name: currentSong.song_name, singers: currentSong.singers, source: currentSong.source },
      }).then(({ data }) => {
        if (data.lyric) { setLyric(data.lyric); return }
        api.post('/refresh-url', {
          song_name: currentSong.song_name, singers: currentSong.singers,
          source: currentSong.source, song_identifier: currentSong.song_identifier,
        }).then(({ data: d }) => { if (d.lyric) setLyric(d.lyric) }).catch(() => {})
      }).catch(() => {
        api.post('/refresh-url', {
          song_name: currentSong.song_name, singers: currentSong.singers,
          source: currentSong.source, song_identifier: currentSong.song_identifier,
        }).then(({ data: d }) => { if (d.lyric) setLyric(d.lyric) }).catch(() => {})
      })
    })
  }, [currentSong])

  // Check favorite status
  useEffect(() => {
    if (!currentSong) return
    import('../../services/api').then(({ default: api }) => {
      api.get('/playlists').then(({ data }) => {
        const fav = data.find((p: any) => p.is_favorite)
        if (fav) {
          setIsFav(!!fav.songs?.some(
            (s: any) => s.source === currentSong.source && s.song_identifier === currentSong.song_identifier
          ))
        } else setIsFav(false)
      }).catch(() => setIsFav(false))
    })
  }, [currentSong])

  const handleToggleFav = async () => {
    if (!currentSong) return
    const { default: api } = await import('../../services/api')
    const { data } = await api.get('/playlists')
    const fav = data.find((p: any) => p.is_favorite)
    if (!fav) return
    if (isFav) {
      const song = fav.songs?.find(
        (s: any) => s.source === currentSong.source && s.song_identifier === currentSong.song_identifier
      )
      if (song) { await api.delete(`/playlists/${fav.id}/songs/${song.id}`); setIsFav(false) }
    } else {
      await api.post(`/playlists/${fav.id}/songs`, {
        song_name: currentSong.song_name, singers: currentSong.singers,
        album: currentSong.album || '', ext: currentSong.ext || 'mp3',
        duration: currentSong.duration_s || 0, source: currentSong.source,
        song_identifier: currentSong.song_identifier,
        lyric: currentSong.lyric || '', cover_url: currentSong.cover_url || '',
      })
      setIsFav(true)
    }
  }

  const handleTogglePlay = () => {
    togglePlay()
    const audio = document.querySelector('audio') as HTMLAudioElement | null
    if (audio) {
      if (isPlaying) { audio.pause() }
      else { audio.play().catch(() => {}) }
    }
  }

  const handleNext = () => {
    next()
    const audio = document.querySelector('audio') as HTMLAudioElement | null
    if (audio) audio.play().catch(() => {})
  }

  const handlePrev = () => {
    prev()
    const audio = document.querySelector('audio') as HTMLAudioElement | null
    if (audio) audio.play().catch(() => {})
  }

  const handleAiMood = async () => {
    if (!currentSong || aiLoading) return
    setAiLoading(true)
    try {
      const { data } = await api.post('/ai/mood', {
        song_name: currentSong.song_name,
        singers: currentSong.singers,
      })
      if (data.mood) {
        setAiResult({
          mood: data.mood,
          score: data.score || 0,
          commentary: data.commentary || '',
          emoji: data.emoji || '',
        })
      }
    } catch {
      // silent fail
    }
    setAiLoading(false)
  }

  const extractColor = (img: HTMLImageElement) => {
    try {
      const canvas = document.createElement('canvas')
      const size = 10; canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0, size, size)
      const data = ctx.getImageData(0, 0, size, size).data
      let r = 0, g = 0, b = 0, count = 0
      for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; count++ }
      r = Math.round(r / count * 0.5); g = Math.round(g / count * 0.5); b = Math.round(b / count * 0.5)
      setDominantColor(`rgb(${r}, ${g}, ${b})`)
    } catch {}
  }

  if (!showFullPlayer || !currentSong) return null

  const timerOptions = [10, 15, 30, 45, 60, 90]
  const modeIcon = playMode === 'random' ? Shuffle : playMode === 'single' ? Repeat1 : Repeat

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: dominantColor, zIndex: 200,
      display: 'flex', flexDirection: 'column',
      transition: 'background 0.8s ease', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 100%)' }} />

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button onClick={() => setShowFullPlayer(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: 4 }}>
            <ChevronDown size={28} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1.5 }}>正在播放</div>
          </div>
          <button onClick={() => setShowTimer(!showTimer)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: remaining ? '#fc3c44' : 'rgba(255,255,255,0.8)', padding: 4, position: 'relative' }}>
            <Timer size={22} />
            {remaining && <span style={{ position: 'absolute', top: -2, right: -2, background: '#fc3c44', color: '#fff', fontSize: 8, padding: '1px 3px', borderRadius: 4, fontWeight: 700 }}>{remaining}</span>}
          </button>
        </div>

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.4 }}>
            <AudioVisualizer height={160} />
          </div>
          {!showLyrics ? (
            /* Cover - click to show lyrics */
            <div
              onClick={() => setShowLyrics(true)}
              style={{
                width: isMobile ? 'min(220px, 60vw)' : 'min(280px, 65vw)', height: isMobile ? 'min(220px, 60vw)' : 'min(280px, 65vw)',
                borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                background: 'rgba(0,0,0,0.2)', flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              {currentSong.cover_url ? (
                <img
                  src={currentSong.cover_url} alt="" crossOrigin="anonymous"
                  onLoad={(e) => extractColor(e.currentTarget)}
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16,
                    animation: isPlaying ? 'happymusic-spin 20s linear infinite' : 'none',
                    animationPlayState: isPlaying ? 'running' : 'paused',
                  }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Music2 size={64} style={{ color: 'rgba(255,255,255,0.3)' }} />
                </div>
              )}
            </div>
          ) : (
            /* Lyrics with seek support */
            <Lyrics lyric={lyric} currentTime={currentTime} onSeek={(t: number) => {
              const audio = document.querySelector('audio') as HTMLAudioElement | null
              if (audio) audio.currentTime = t
            }} onBack={() => setShowLyrics(false)} />
          )}

          {/* Toggle buttons */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => setShowLyrics(!showLyrics)} style={{
              padding: '6px 16px', background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: 20, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Mic2 size={12} /> {showLyrics ? '查看封面' : '查看歌词'}
            </button>
            {/* 倍速 */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowSpeed(!showSpeed); setShowTimer(false) }} style={{
                padding: '6px 16px', background: rate !== 1 ? 'rgba(252,60,68,0.2)' : 'rgba(255,255,255,0.1)', border: 'none',
                borderRadius: 20, color: rate !== 1 ? '#fff' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Gauge size={12} /> {formatSpeed(rate)}
              </button>
              {showSpeed && (
                <div style={{
                  position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.9)', borderRadius: 10, padding: 6, display: 'flex', gap: 2, flexWrap: 'wrap',
                  maxWidth: 220, justifyContent: 'center',
                }}>
                  {SPEED_PRESETS.map((s) => (
                    <button key={s} onClick={() => { setRate(s); setShowSpeed(false) }} style={{
                      padding: '6px 10px', background: Math.abs(s - rate) < 0.01 ? '#fc3c44' : 'rgba(255,255,255,0.1)',
                      border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 11,
                    }}>
                      {formatSpeed(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* AB复读 */}
            <button onClick={() => toggleAbPoint(currentTime)} onDoubleClick={clearAb} style={{
              padding: '6px 16px', background: abLoop.a != null ? 'rgba(252,60,68,0.2)' : 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: 20, color: abLoop.a != null ? '#fff' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 4,
            }} title="按设置 A/B 点,双击清除">
              <Repeat size={12} /> {abLoop.b != null ? 'AB中' : abLoop.a != null ? '设B点' : 'AB复读'}
            </button>
            <button onClick={handleAiMood} disabled={aiLoading} style={{
              padding: '6px 16px', background: aiResult ? 'rgba(52,199,89,0.2)' : 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: 20, color: aiResult ? '#34C759' : 'rgba(255,255,255,0.6)', cursor: aiLoading ? 'not-allowed' : 'pointer', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {aiLoading ? <span style={{ animation: 'spin 1s linear infinite', display: 'inline-flex' }}><Sparkles size={12} /></span> : <Brain size={12} />}
              {aiLoading ? '分析中...' : aiResult ? 'AI 解读' : 'AI 解读'}
            </button>
            <button onClick={() => setShowShareCard(true)} style={{
              padding: '6px 16px', background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: 20, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Share2 size={12} /> 分享卡片
            </button>
          </div>

          {/* AI Mood Result Card */}
          {aiResult && (
            <div style={{
              marginTop: 12, padding: '14px 18px',
              background: 'rgba(255,255,255,0.08)', borderRadius: 14,
              backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)',
              maxWidth: 360, width: '100%', alignSelf: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{aiResult.emoji}</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
                    {aiResult.mood}
                    <span style={{ marginLeft: 8, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>
                      情绪指数 {aiResult.score}/100
                    </span>
                  </div>
                </div>
              </div>
              {/* Score bar */}
              <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${aiResult.score}%`, background: 'linear-gradient(90deg, #34C759, #FFD93D, #FF6B6B)', borderRadius: 2, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                {aiResult.commentary}
              </div>
            </div>
          )}
        </div>

        {/* Song info */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 16 : 24, marginTop: 12 }}>
          <h2 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{currentSong.song_name}</h2>
          <p style={{ fontSize: isMobile ? 12 : 14, color: 'rgba(255,255,255,0.6)' }}>
            {currentSong.singers ? (
              <span style={{ cursor: 'pointer' }} onClick={() => { setShowFullPlayer(false); navigate(`/discover?type=artist&name=${encodeURIComponent(currentSong.singers)}`) }}>
                {currentSong.singers}
              </span>
            ) : null}
            {currentSong.album ? (
              <span style={{ cursor: 'pointer' }} onClick={() => { setShowFullPlayer(false); navigate(`/discover?type=album&name=${encodeURIComponent(currentSong.album)}`) }}>
                {' '}· {currentSong.album}
              </span>
            ) : null}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 16 : 24, marginBottom: isMobile ? 12 : 20 }}>
          {/* Heart */}
          <button onClick={handleToggleFav}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFav ? '#ef4444' : 'rgba(255,255,255,0.5)', padding: 4 }}>
            <Heart size={22} fill={isFav ? '#ef4444' : 'none'} />
          </button>
          <button onClick={() => setPlayMode(playMode === 'sequence' ? 'random' : playMode === 'random' ? 'single' : 'sequence')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: playMode !== 'sequence' ? 'var(--accent)' : 'rgba(255,255,255,0.5)', padding: 4 }}>
            {(() => { const Icon = modeIcon; return <Icon size={22} /> })()}
          </button>
          <button onClick={handlePrev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}>
            <SkipBack size={28} fill="currentColor" />
          </button>
          <button onClick={handleTogglePlay} style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#fff', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#000',
          }}>
            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" style={{ marginLeft: 3 }} />}
          </button>
          <button onClick={handleNext} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}>
            <SkipForward size={28} fill="currentColor" />
          </button>
          {/* Add to playlist */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowPlaylist(!showPlaylist)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: showPlaylist ? 'var(--accent)' : 'rgba(255,255,255,0.5)', padding: 4 }}>
              <ListPlus size={22} />
            </button>
            {showPlaylist && currentSong && (
              <div style={{ position: 'absolute', bottom: 40, right: -20 }}>
                <AddToPlaylist song={currentSong} onClose={() => setShowPlaylist(false)} onAdded={() => {}} />
              </div>
            )}
          </div>
        </div>
      </div>

      {showTimer && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)',
          padding: 24, borderRadius: '16px 16px 0 0', zIndex: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ color: '#fff', fontWeight: 600 }}>定时关闭</span>
            <button onClick={() => setShowTimer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {timerOptions.map((m) => (
              <button key={m} onClick={() => { setTimer(m); setShowTimer(false) }}
                style={{ padding: 12, background: timerMinutes === m ? 'var(--accent)' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
                {m} 分钟
              </button>
            ))}
            <button onClick={() => { setTimer(null); setShowTimer(false) }}
              style={{ padding: 12, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 'var(--radius-sm)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14 }}>
              取消
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes happymusic-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      {showShareCard && currentSong && <ShareCard song={currentSong} onClose={() => setShowShareCard(false)} />}
    </div>
  )
}
