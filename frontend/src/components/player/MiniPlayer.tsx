import { useEffect, useRef, useState, useCallback } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { getSongBlob, addRecent, songId } from '../../hooks/useDB'
import { useIsMobile } from '../../hooks/useBreakpoint'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Repeat, Shuffle, Repeat1, Maximize2, Music2, Sliders,
  Heart, ListPlus,
} from 'lucide-react'
import type { Song } from '../../types'
import Equalizer from './Equalizer'
import { reportPlay } from '../../hooks/usePlayStats'
import AddToPlaylist from '../AddToPlaylist'

const FADE_DURATION = 800

// Comfort voice logic using Web Speech API
async function playComfortVoice() {
  try {
    const { default: api } = await import('../../services/api')
    const { data } = await api.post('/ai/comfort', null, { timeout: 15000 })
    if (!data.text) return

    // Lower music volume
    const audio = document.querySelector('audio') as HTMLAudioElement | null
    const savedVolume = audio?.volume || 0.8
    if (audio) audio.volume = savedVolume * 0.15

    // Use Web Speech API
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(data.text)
      utterance.lang = 'zh-CN'
      utterance.pitch = 1.0
      utterance.rate = 0.9
      utterance.onend = () => {
        if (audio) audio.volume = savedVolume
      }
      utterance.onerror = () => {
        if (audio) audio.volume = savedVolume
      }
      speechSynthesis.speak(utterance)
    } else {
      // No speech API, restore volume
      if (audio) audio.volume = savedVolume
    }
  } catch {
    // Silent fail
  }
}

export default function MiniPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const fadeRef = useRef<HTMLAudioElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [fading, setFading] = useState(false)
  const [showEq, setShowEq] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [isFav, setIsFav] = useState(false)
  const isMobile = useIsMobile()
  const playStartRef = useRef<number>(0)
  const reportedRef = useRef<string>('')
  const {
    currentSong, isPlaying, volume, playMode,
    togglePlay, next, prev, setVolume, setPlayMode,
    setShowFullPlayer,
  } = usePlayerStore()

  const fadeInAudio = useCallback((audio: HTMLAudioElement, targetVol: number) => {
    audio.volume = 0
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / FADE_DURATION)
      audio.volume = targetVol * progress
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [])

  const fadeOutAudio = useCallback((audio: HTMLAudioElement, onDone: () => void) => {
    const startVol = audio.volume
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / FADE_DURATION)
      audio.volume = startVol * (1 - progress)
      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        audio.pause()
        onDone()
      }
    }
    requestAnimationFrame(step)
  }, [])

  const refreshAndPlay = useCallback(async (song: Song) => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused && !fading) {
      const oldAudio = new Audio(audio.src)
      oldAudio.currentTime = audio.currentTime
      oldAudio.volume = audio.volume
      oldAudio.play().catch(() => {})
      fadeRef.current = oldAudio
      setFading(true)
      fadeOutAudio(oldAudio, () => { oldAudio.src = ''; setFading(false) })
    }
    const id = songId(song.source, song.song_identifier)
    const blob = await getSongBlob(id)
    if (blob) {
      audio.src = URL.createObjectURL(blob)
    } else if (song.download_url) {
      audio.src = song.download_url
    } else {
      try {
        const api = (await import('../../services/api')).default
        const { data } = await api.post('/refresh-url', {
          song_name: song.song_name, singers: song.singers,
          source: song.source, song_identifier: song.song_identifier,
        })
        audio.src = data.download_url
      } catch { return }
    }
    audio.volume = 0
    audio.play().catch(() => {})
    fadeInAudio(audio, volume)
    playStartRef.current = Date.now()
  }, [volume, fading, fadeInAudio, fadeOutAudio])

  // Check if current song is in favorites
  useEffect(() => {
    if (!currentSong) return
    import('../../services/api').then(({ default: api }) => {
      api.get('/playlists').then(({ data }) => {
        const fav = data.find((p: any) => p.is_favorite)
        if (fav) {
          const found = fav.songs?.some(
            (s: any) => s.source === currentSong.source && s.song_identifier === currentSong.song_identifier
          )
          setIsFav(!!found)
        } else {
          setIsFav(false)
        }
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
      if (song) {
        await api.delete(`/playlists/${fav.id}/songs/${song.id}`)
        setIsFav(false)
      }
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

  useEffect(() => {
    if (!currentSong) return
    refreshAndPlay(currentSong)
    addRecent({
      song_name: currentSong.song_name, singers: currentSong.singers,
      album: currentSong.album, ext: currentSong.ext,
      duration_s: currentSong.duration_s, source: currentSong.source,
      song_identifier: currentSong.song_identifier,
      cover_url: currentSong.cover_url, lyric: currentSong.lyric,
    })
  }, [currentSong])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.play().catch(() => {})
    else audio.pause()
  }, [isPlaying])

  useEffect(() => {
    if (audioRef.current && !fading) audioRef.current.volume = volume
  }, [volume, fading])

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
  }
  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration)
  }
  const handleEnded = () => {
    if (currentSong && playStartRef.current) {
      const key = `${currentSong.source}:${currentSong.song_identifier}`
      if (reportedRef.current !== key) {
        const played = (Date.now() - playStartRef.current) / 1000
        reportPlay(currentSong, played)
        reportedRef.current = key
      }
    }

    // Comfort voice check
    try {
      const { useComfortStore } = require('../../stores/comfortStore')
      const comfortStore = useComfortStore.getState()
      if (comfortStore.enabled) {
        const shouldTrigger = comfortStore.recordSongPlayed()
        if (shouldTrigger) {
          comfortStore.resetCounter()
          playComfortVoice()
        }
      }
    } catch {}

    const { playMode } = usePlayerStore.getState()
    if (playMode === 'single') { audioRef.current?.play() } else { next() }
  }
  const handleError = () => {
    if (currentSong) {
      import('../../services/api').then(({ default: api }) => {
        api.post('/refresh-url', {
          song_name: currentSong.song_name, singers: currentSong.singers,
          source: currentSong.source, song_identifier: currentSong.song_identifier,
        }).then(({ data }) => {
          if (audioRef.current) { audioRef.current.src = data.download_url; audioRef.current.play().catch(() => {}) }
        }).catch(() => next())
      })
    }
  }
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value)
    if (audioRef.current) audioRef.current.currentTime = t
    setCurrentTime(t)
  }
  const fmt = (s: number) => {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const modeIcon = playMode === 'random' ? Shuffle : playMode === 'single' ? Repeat1 : Repeat
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (!currentSong) return null

  const mobileBottomOffset = isMobile ? 52 : 0

  // ====== MOBILE MINI PLAYER ======
  if (isMobile) {
    return (
      <div style={{
        position: 'fixed', bottom: mobileBottomOffset, left: 0, right: 0,
        background: 'var(--player-bg)',
        borderTop: '1px solid var(--border)',
        zIndex: 50,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ position: 'absolute', top: -2, left: 0, right: 0, height: 3, background: 'var(--bg-tertiary)', cursor: 'pointer' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', transition: 'width 0.1s linear' }} />
          <input type="range" min={0} max={duration || 0} step={0.1} value={currentTime} onChange={handleSeek}
            style={{ position: 'absolute', top: -4, left: 0, width: '100%', opacity: 0, cursor: 'pointer', height: 12 }} />
        </div>

        <audio ref={audioRef} onEnded={handleEnded} onError={handleError} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} />

        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: 64, gap: 8 }}>
          {/* Cover */}
          <div onClick={() => setShowFullPlayer(true)} style={{
            width: 42, height: 42, borderRadius: 8,
            background: 'var(--bg-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
          }}>
            {currentSong.cover_url ? (
              <img src={currentSong.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Music2 size={18} style={{ color: 'var(--text-tertiary)' }} />
            )}
          </div>

          {/* Song info */}
          <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentSong.song_name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentSong.singers}
            </div>
          </div>

          {/* Time */}
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace', flexShrink: 0 }}>
            {fmt(currentTime)}/{fmt(duration)}
          </span>

          {/* Controls - compact */}
          <button onClick={handleToggleFav} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFav ? '#ef4444' : 'var(--text-secondary)', padding: 4, flexShrink: 0 }}>
            <Heart size={18} fill={isFav ? '#ef4444' : 'none'} />
          </button>
          <button onClick={prev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 4, flexShrink: 0 }}>
            <SkipBack size={18} fill="currentColor" />
          </button>
          <button onClick={togglePlay} style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--accent)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff', flexShrink: 0,
          }}>
            {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>
          <button onClick={next} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 4, flexShrink: 0 }}>
            <SkipForward size={18} fill="currentColor" />
          </button>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setShowPlaylist(!showPlaylist)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
              <ListPlus size={18} />
            </button>
            {showPlaylist && currentSong && (
              <AddToPlaylist song={currentSong} onClose={() => setShowPlaylist(false)} onAdded={() => {}} />
            )}
          </div>
        </div>

        <Equalizer show={showEq} onClose={() => setShowEq(false)} />
      </div>
    )
  }

  // ====== DESKTOP MINI PLAYER ======
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--player-bg)',
      borderTop: '1px solid var(--border)',
      zIndex: 50,
      backdropFilter: 'blur(20px)',
    }}>
      <div style={{ position: 'absolute', top: -2, left: 0, right: 0, height: 3, background: 'var(--bg-tertiary)', cursor: 'pointer' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', transition: 'width 0.1s linear' }} />
        <input type="range" min={0} max={duration || 0} step={0.1} value={currentTime} onChange={handleSeek}
          style={{ position: 'absolute', top: -4, left: 0, width: '100%', opacity: 0, cursor: 'pointer', height: 12 }} />
      </div>

      <audio ref={audioRef} onEnded={handleEnded} onError={handleError} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} />

      <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: 'var(--player-height)', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 260, flexShrink: 0 }}>
          <div onClick={() => setShowFullPlayer(true)} style={{
            width: 48, height: 48, borderRadius: 8,
            background: 'var(--bg-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
          }}>
            {currentSong.cover_url ? (
              <img src={currentSong.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Music2 size={20} style={{ color: 'var(--text-tertiary)' }} />
            )}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentSong.song_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentSong.singers}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 80, textAlign: 'center', flexShrink: 0, fontFamily: 'monospace' }}>
          {fmt(currentTime)} / {fmt(duration)}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <button onClick={handleToggleFav} title={isFav ? '取消喜欢' : '我喜欢'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFav ? '#ef4444' : 'var(--text-secondary)', padding: 4 }}>
            <Heart size={16} fill={isFav ? '#ef4444' : 'none'} />
          </button>
          <button onClick={() => setPlayMode(playMode === 'sequence' ? 'random' : playMode === 'random' ? 'single' : 'sequence')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: playMode !== 'sequence' ? 'var(--accent)' : 'var(--text-secondary)', padding: 4 }}>
            {(() => { const Icon = modeIcon; return <Icon size={16} /> })()}
          </button>
          <button onClick={prev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 4 }}>
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button onClick={togglePlay} style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--accent)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
          }}>
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>
          <button onClick={next} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 4 }}>
            <SkipForward size={20} fill="currentColor" />
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowPlaylist(!showPlaylist)} title="添加到歌单"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
              <ListPlus size={16} />
            </button>
            {showPlaylist && currentSong && (
              <AddToPlaylist song={currentSong} onClose={() => setShowPlaylist(false)} onAdded={() => {}} />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 220, flexShrink: 0, justifyContent: 'flex-end' }}>
          <button onClick={() => setShowEq(true)} title="均衡器"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            <Sliders size={16} />
          </button>
          <button onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            {volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <input type="range" min={0} max={1} step={0.01} value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ width: 80, accentColor: 'var(--accent)' }} />
          <button onClick={() => setShowFullPlayer(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <Equalizer show={showEq} onClose={() => setShowEq(false)} />
    </div>
  )
}
