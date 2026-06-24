import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../../stores/playerStore'

let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let sourceNode: MediaElementAudioSourceNode | null = null
let connected = false

export function getAnalyser(audio: HTMLAudioElement): AnalyserNode | null {
  if (connected && analyser) return analyser
  try {
    if (!audioContext) {
      audioContext = new AudioContext()
    }
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.8
    sourceNode = audioContext.createMediaElementSource(audio)
    sourceNode.connect(analyser)
    analyser.connect(audioContext.destination)
    connected = true
    return analyser
  } catch {
    return null
  }
}

export function disconnectAnalyser() {
  connected = false
  analyser = null
  sourceNode = null
  if (audioContext) {
    audioContext.close().catch(() => {})
    audioContext = null
  }
}

interface Props {
  height?: number
}

export default function AudioVisualizer({ height = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { isPlaying } = usePlayerStore()

  useEffect(() => {
    if (!isPlaying) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const audio = document.querySelector('audio') as HTMLAudioElement | null
      if (!audio) return

      const an = getAnalyser(audio)
      if (!an) return

      const w = canvas.width
      const h = canvas.height
      const bufLen = an.frequencyBinCount
      const data = new Uint8Array(bufLen)
      an.getByteFrequencyData(data)

      ctx.clearRect(0, 0, w, h)

      const barCount = Math.min(bufLen, 48)
      const gap = 3
      const barW = (w - gap * (barCount - 1)) / barCount

      for (let i = 0; i < barCount; i++) {
        const val = data[i] / 255
        const barH = Math.max(2, val * h * 0.9)
        const x = i * (barW + gap)
        const y = h - barH

        const gradient = ctx.createLinearGradient(x, y, x, h)
        gradient.addColorStop(0, `rgba(255, 255, 255, ${0.3 + val * 0.5})`)
        gradient.addColorStop(1, `rgba(255, 255, 255, 0.05)`)
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.roundRect(x, y, barW, barH, [barW / 2, barW / 2, 0, 0])
        ctx.fill()
      }
    }

    const resize = () => {
      const parent = canvas.parentElement
      if (parent) {
        canvas.width = parent.clientWidth
        canvas.height = height
      }
    }
    resize()
    window.addEventListener('resize', resize)
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [isPlaying, height])

  if (!isPlaying) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height,
        opacity: 0.6,
        pointerEvents: 'none',
      }}
    />
  )
}
