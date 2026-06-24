import { useState, useRef, useEffect, useCallback } from 'react'
import { useIsMobile } from '../hooks/useBreakpoint'
import { usePlayerStore } from '../stores/playerStore'
import { getSongBlob, songId } from '../hooks/useDB'
import { Scissors, Play, Pause, Download, RotateCcw } from 'lucide-react'

const MAX_DURATION = 30

export default function RingtoneMaker() {
  const isMobile = useIsMobile()
  const { currentSong } = usePlayerStore()
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(MAX_DURATION)
  const [playing, setPlaying] = useState(false)
  const [waveform, setWaveform] = useState<number[]>([])
  const [loading, setLoading] = useState(false)

  const loadAudio = useCallback(async () => {
    if (!currentSong) return
    setLoading(true)
    try {
      const id = songId(currentSong.source, currentSong.song_identifier)
      const blob = await getSongBlob(id)
      if (blob) {
        setAudioUrl(URL.createObjectURL(blob))
      } else if (currentSong.download_url) {
        setAudioUrl(currentSong.download_url)
      } else {
        const api = (await import('../services/api')).default
        const { data } = await api.post('/refresh-url', {
          song_name: currentSong.song_name, singers: currentSong.singers,
          source: currentSong.source, song_identifier: currentSong.song_identifier,
        })
        setAudioUrl(data.download_url)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [currentSong])

  useEffect(() => {
    if (!currentSong) return
    loadAudio()
  }, [currentSong])

  // Generate waveform
  useEffect(() => {
    if (!audioUrl) return
    const audio = new Audio(audioUrl)
    audio.crossOrigin = 'anonymous'
    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaElementSource(audio)

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration)
      setEnd(Math.min(MAX_DURATION, audio.duration))
    })

    source.connect(audioCtx.destination)

    const fetchAndDecode = async () => {
      try {
        const resp = await fetch(audioUrl)
        const buffer = await resp.arrayBuffer()
        const audioBuffer = await audioCtx.decodeAudioData(buffer)
        const channel = audioBuffer.getChannelData(0)
        const samples = 200
        const step = Math.floor(channel.length / samples)
        const peaks: number[] = []
        for (let i = 0; i < samples; i++) {
          let max = 0
          for (let j = 0; j < step; j++) {
            const val = Math.abs(channel[i * step + j] || 0)
            if (val > max) max = val
          }
          peaks.push(max)
        }
        setWaveform(peaks)
      } catch {
        // CORS or decode error
      }
    }
    fetchAndDecode()

    return () => { audioCtx.close().catch(() => {}) }
  }, [audioUrl])

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || waveform.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width = canvas.clientWidth * 2
    const h = canvas.height = canvas.clientHeight * 2
    ctx.clearRect(0, 0, w, h)

    const barW = w / waveform.length
    const startPx = (start / duration) * w
    const endPx = (end / duration) * w

    waveform.forEach((val, i) => {
      const x = i * barW
      const barH = val * h * 0.8
      const inRange = x >= startPx && x <= endPx
      ctx.fillStyle = inRange ? 'var(--accent)' : 'var(--text-tertiary)'
      ctx.globalAlpha = inRange ? 0.9 : 0.3
      ctx.fillRect(x, (h - barH) / 2, barW - 1, barH)
    })

    ctx.globalAlpha = 1
    // Range markers
    ctx.strokeStyle = 'var(--accent)'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(startPx, 0); ctx.lineTo(startPx, h)
    ctx.moveTo(endPx, 0); ctx.lineTo(endPx, h)
    ctx.stroke()
    ctx.setLineDash([])
  }, [waveform, start, end, duration])

  const handlePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.currentTime = start
      audioRef.current.play()
      setPlaying(true)
    }
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    const t = audioRef.current.currentTime
    if (t >= end) {
      audioRef.current.pause()
      setPlaying(false)
    }
  }

  const handleExport = async () => {
    if (!audioUrl) return
    try {
      const resp = await fetch(audioUrl)
      const buffer = await resp.arrayBuffer()
      const audioCtx = new AudioContext()
      const audioBuffer = await audioCtx.decodeAudioData(buffer)
      const startSample = Math.floor(start * audioBuffer.sampleRate)
      const endSample = Math.floor(end * audioBuffer.sampleRate)
      const length = endSample - startSample
      const newBuffer = audioCtx.createBuffer(audioBuffer.numberOfChannels, length, audioBuffer.sampleRate)
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const source = audioBuffer.getChannelData(ch)
        const target = newBuffer.getChannelData(ch)
        for (let i = 0; i < length; i++) {
          target[i] = source[startSample + i]
        }
      }
      // Encode to WAV
      const wavBuffer = encodeWav(newBuffer)
      const blob = new Blob([wavBuffer], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ringtone_${currentSong?.song_name || 'audio'}.wav`
      a.click()
      URL.revokeObjectURL(url)
      audioCtx.close()
    } catch {
      alert('导出失败，请确保音频已下载到本地缓存')
    }
  }

  const handleReset = () => {
    setStart(0)
    setEnd(Math.min(MAX_DURATION, duration))
  }

  if (!currentSong) {
    return (
      <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120, textAlign: 'center', paddingTop: 80 }}>
        <Scissors size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 16, opacity: 0.5 }} />
        <p style={{ color: 'var(--text-tertiary)' }}>请先播放一首歌，然后使用铃声裁剪</p>
      </div>
    )
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    const ms = Math.floor((s % 1) * 100)
    return `${m}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Scissors size={24} style={{ color: 'var(--accent)' }} />
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>铃声裁剪</h2>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', padding: 24, border: '1px solid var(--border)' }}>
        <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
          {currentSong.song_name} - {currentSong.singers}
        </div>

        {/* Waveform */}
        <canvas ref={canvasRef} style={{ width: '100%', height: 100, borderRadius: 8, background: 'var(--bg-secondary)' }} />

        {/* Controls */}
        <audio ref={audioRef} src={audioUrl} onTimeUpdate={handleTimeUpdate} onEnded={() => setPlaying(false)} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button onClick={handlePlay} style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--accent)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
          }}>
            {playing ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
          </button>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 40 }}>开始</span>
              <input type="range" min={0} max={duration} step={0.1} value={start}
                onChange={(e) => setStart(Math.min(parseFloat(e.target.value), end - 0.5))}
                style={{ flex: 1, accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 12, fontFamily: 'monospace', width: 70 }}>{fmt(start)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 40 }}>结束</span>
              <input type="range" min={0} max={duration} step={0.1} value={end}
                onChange={(e) => setEnd(Math.max(parseFloat(e.target.value), start + 0.5))}
                style={{ flex: 1, accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 12, fontFamily: 'monospace', width: 70 }}>{fmt(end)}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            选中长度: {fmt(end - start)} (最长 {MAX_DURATION}秒)
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleReset} style={{
              padding: '8px 14px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <RotateCcw size={14} />重置
            </button>
            <button onClick={handleExport} disabled={loading} style={{
              padding: '8px 14px', background: 'var(--accent)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              cursor: loading ? 'wait' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Download size={14} />导出铃声
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const bytesPerSample = 2
  const dataLength = length * numChannels * bytesPerSample
  const headerLength = 44
  const totalLength = headerLength + dataLength
  const arrayBuffer = new ArrayBuffer(totalLength)
  const view = new DataView(arrayBuffer)

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, totalLength - 8, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true)
  view.setUint16(34, bytesPerSample * 8, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  const channels = Array.from({ length: numChannels }, (_, i) => buffer.getChannelData(i))
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      view.setInt16(offset, sample * 0x7FFF, true)
      offset += 2
    }
  }
  return arrayBuffer
}
