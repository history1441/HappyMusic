import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Sliders } from 'lucide-react'

interface EqPreset {
  name: string
  bands: number[] // gains in dB for each frequency band
}

const BANDS = [60, 230, 910, 3600, 14000]
const BAND_LABELS = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz']

const PRESETS: EqPreset[] = [
  { name: '默认', bands: [0, 0, 0, 0, 0] },
  { name: '流行', bands: [1, 3, 5, 3, 1] },
  { name: '摇滚', bands: [5, 3, -1, 2, 4] },
  { name: '古典', bands: [0, 0, 0, 2, 4] },
  { name: '爵士', bands: [3, 1, -1, 1, 3] },
  { name: '电子', bands: [5, 3, 0, 2, 5] },
  { name: '人声', bands: [-2, 0, 4, 3, -1] },
  { name: '低音增强', bands: [6, 4, 0, 0, 0] },
]

const STORAGE_KEY = 'happymusic_eq_preset'

let filters: BiquadFilterNode[] = []
let eqAudioCtx: AudioContext | null = null
let eqSource: MediaElementAudioSourceNode | null = null
let eqConnected = false

function ensureEqNodes(audio: HTMLAudioElement) {
  if (eqConnected && filters.length > 0) {
    if (eqAudioCtx?.state === 'suspended') eqAudioCtx.resume()
    return filters
  }

  try {
    eqAudioCtx = new AudioContext()
    eqSource = eqAudioCtx.createMediaElementSource(audio)

    filters = BANDS.map((freq, i) => {
      const f = eqAudioCtx!.createBiquadFilter()
      f.type = i === 0 ? 'lowshelf' : i === BANDS.length - 1 ? 'highshelf' : 'peaking'
      f.frequency.value = freq
      f.Q.value = 1
      f.gain.value = 0
      return f
    })

    let node: AudioNode = eqSource
    for (const f of filters) {
      node.connect(f)
      node = f
    }
    node.connect(eqAudioCtx.destination)
    eqConnected = true
    if (eqAudioCtx.state === 'suspended') eqAudioCtx.resume()
    return filters
  } catch {
    return []
  }
}

export function applyEqPreset(presetName: string) {
  const preset = PRESETS.find((p) => p.name === presetName)
  if (!preset) return
  const audio = document.querySelector('audio') as HTMLAudioElement | null
  if (!audio) return
  const nodes = ensureEqNodes(audio)
  nodes.forEach((f, i) => {
    f.gain.value = preset.bands[i]
  })
}

interface Props {
  show: boolean
  onClose: () => void
}

export default function Equalizer({ show, onClose }: Props) {
  const [activePreset, setActivePreset] = useState(() =>
    localStorage.getItem(STORAGE_KEY) || '默认'
  )
  const [bands, setBands] = useState<number[]>(() => {
    const p = PRESETS.find((pr) => pr.name === (localStorage.getItem(STORAGE_KEY) || '默认'))
    return p ? p.bands : [0, 0, 0, 0, 0]
  })
  const applied = useRef(false)

  useEffect(() => {
    if (show && !applied.current) {
      applyEqPreset(activePreset)
      applied.current = true
    }
  }, [show, activePreset])

  const handleBandChange = useCallback((idx: number, val: number) => {
    const newBands = [...bands]
    newBands[idx] = val
    setBands(newBands)
    setActivePreset('自定义')

    const audio = document.querySelector('audio') as HTMLAudioElement | null
    if (audio) {
      const nodes = ensureEqNodes(audio)
      if (nodes[idx]) nodes[idx].gain.value = val
    }
  }, [bands])

  const handlePreset = useCallback((preset: EqPreset) => {
    setBands([...preset.bands])
    setActivePreset(preset.name)
    localStorage.setItem(STORAGE_KEY, preset.name)
    applyEqPreset(preset.name)
  }, [])

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }}>
      <div style={{
        width: 420, background: 'var(--card)', borderRadius: 16,
        padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontWeight: 700, fontSize: 18 }}>均衡器</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Preset buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => handlePreset(p)}
              style={{
                padding: '6px 14px', borderRadius: 20,
                background: activePreset === p.name ? 'var(--accent)' : 'var(--bg-secondary)',
                border: 'none', color: activePreset === p.name ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}>
              {p.name}
            </button>
          ))}
        </div>

        {/* Band sliders */}
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: 180, marginBottom: 8 }}>
          {bands.map((val, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, width: 36, textAlign: 'center' }}>
                {val > 0 ? '+' : ''}{val}
              </span>
              <div style={{
                position: 'relative', height: 120, width: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <input
                  type="range"
                  min={-10}
                  max={10}
                  step={1}
                  value={val}
                  onChange={(e) => handleBandChange(i, parseInt(e.target.value))}
                  style={{
                    width: 120,
                    transform: 'rotate(-90deg)',
                    accentColor: 'var(--accent)',
                  }}
                />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{BAND_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
