import { useRef, useCallback } from 'react'
import { X, Download, Share2 } from 'lucide-react'
import type { Song } from '../../types'

interface Props {
  song: Song
  onClose: () => void
}

const W = 600
const H = 800

export default function ShareCard({ song, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const generateCard = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = W
    canvas.height = H

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#1a1a2e')
    bg.addColorStop(0.5, '#16213e')
    bg.addColorStop(1, '#0f3460')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Decorative circles
    ctx.globalAlpha = 0.05
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.arc(100 + i * 90, 650, 60 + i * 20, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Cover image
    const coverSize = 360
    const coverX = (W - coverSize) / 2
    const coverY = 100

    try {
      if (song.cover_url) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = reject
          img.src = song.cover_url
        })
        // Rounded rectangle clip for cover
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(coverX, coverY, coverSize, coverSize, 20)
        ctx.clip()
        ctx.drawImage(img, coverX, coverY, coverSize, coverSize)
        ctx.restore()

        // Cover shadow
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.4)'
        ctx.shadowBlur = 40
        ctx.shadowOffsetY = 20
        ctx.beginPath()
        ctx.roundRect(coverX, coverY, coverSize, coverSize, 20)
        ctx.strokeStyle = 'transparent'
        ctx.stroke()
        ctx.restore()
      } else {
        // Placeholder cover
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(coverX, coverY, coverSize, coverSize, 20)
        ctx.fillStyle = '#2a2a4a'
        ctx.fill()
        ctx.fillStyle = '#555'
        ctx.font = 'bold 60px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('♪', W / 2, coverY + coverSize / 2 + 20)
        ctx.restore()
      }
    } catch {
      // Fallback placeholder
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(coverX, coverY, coverSize, coverSize, 20)
      ctx.fillStyle = '#2a2a4a'
      ctx.fill()
      ctx.restore()
    }

    // Song name
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    const name = song.song_name.length > 18 ? song.song_name.slice(0, 18) + '...' : song.song_name
    ctx.fillText(name, W / 2, coverY + coverSize + 60)

    // Singers
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(song.singers, W / 2, coverY + coverSize + 100)

    // Album
    if (song.album) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.font = '15px "PingFang SC", "Microsoft YaHei", sans-serif'
      ctx.fillText(song.album, W / 2, coverY + coverSize + 132)
    }

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(80, coverY + coverSize + 170)
    ctx.lineTo(W - 80, coverY + coverSize + 170)
    ctx.stroke()

    // Brand
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText('HappyMusic', W / 2, H - 50)

    // Accent line
    const accentGrad = ctx.createLinearGradient(80, 0, W - 80, 0)
    accentGrad.addColorStop(0, 'rgba(255,107,107,0)')
    accentGrad.addColorStop(0.5, 'rgba(255,107,107,0.6)')
    accentGrad.addColorStop(1, 'rgba(255,107,107,0)')
    ctx.strokeStyle = accentGrad
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(80, H - 30)
    ctx.lineTo(W - 80, H - 30)
    ctx.stroke()
  }, [song])

  const handleSave = async () => {
    await generateCard()
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${song.song_name} - ${song.singers}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }}>
      <div style={{
        width: 460, background: 'var(--card)', borderRadius: 16,
        padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Share2 size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontWeight: 700, fontSize: 18 }}>分享音乐卡片</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
            <X size={20} />
          </button>
        </div>

        <canvas ref={canvasRef} style={{
          width: '100%', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }} />

        <div style={{ display: 'flex', gap: 12, marginTop: 20, width: '100%' }}>
          <button onClick={handleSave} style={{
            flex: 1, padding: '12px 0', background: 'var(--accent)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Download size={16} />
            保存图片
          </button>
        </div>
      </div>
    </div>
  )
}
