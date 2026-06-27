import { useState, useEffect, useRef, useCallback } from 'react'
import { Howler } from 'howler'
import { X, Sliders } from 'lucide-react'
import { cn } from '../utils/cn'

interface EqPreset {
  name: string
  bands: number[]
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
let eqConnected = false

/** 在 Howler 主增益节点与输出之间插入 EQ 滤波链(全局生效)。 */
function ensureEqNodes(): BiquadFilterNode[] {
  if (eqConnected && filters.length > 0) return filters
  try {
    const ctx = (Howler as any).ctx as AudioContext | undefined
    const master = (Howler as any).masterGain as GainNode | undefined
    if (!ctx || !master) return []

    filters = BANDS.map((freq, i) => {
      const f = ctx.createBiquadFilter()
      f.type = i === 0 ? 'lowshelf' : i === BANDS.length - 1 ? 'highshelf' : 'peaking'
      f.frequency.value = freq
      f.Q.value = 1
      f.gain.value = 0
      return f
    })

    // masterGain → filter0 → ... → filterN → destination
    master.disconnect()
    let node: AudioNode = master
    for (const f of filters) {
      node.connect(f)
      node = f
    }
    node.connect(ctx.destination)
    eqConnected = true
    return filters
  } catch {
    return []
  }
}

export function applyEqPreset(presetName: string) {
  const preset = PRESETS.find((p) => p.name === presetName)
  if (!preset) return
  const nodes = ensureEqNodes()
  nodes.forEach((f, i) => {
    if (f) f.gain.value = preset.bands[i]
  })
}

interface Props {
  show: boolean
  onClose: () => void
}

export default function Equalizer({ show, onClose }: Props) {
  const [activePreset, setActivePreset] = useState(() => localStorage.getItem(STORAGE_KEY) || '默认')
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
    const next = [...bands]
    next[idx] = val
    setBands(next)
    setActivePreset('自定义')
    const nodes = ensureEqNodes()
    if (nodes[idx]) nodes[idx].gain.value = val
  }, [bands])

  const handlePreset = useCallback((preset: EqPreset) => {
    setBands([...preset.bands])
    setActivePreset(preset.name)
    localStorage.setItem(STORAGE_KEY, preset.name)
    applyEqPreset(preset.name)
  }, [])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50">
      <div className="w-[420px] max-w-[90vw] rounded-xl bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders size={20} className="text-primary" />
            <h3 className="text-lg font-bold">均衡器</h3>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text">
            <X size={20} />
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => handlePreset(p)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                activePreset === p.name ? 'bg-primary text-white' : 'bg-border text-text-secondary hover:text-text'
              )}>
              {p.name}
            </button>
          ))}
        </div>

        <div className="mb-2 flex items-end justify-around" style={{ height: 180 }}>
          {bands.map((val, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <span className="w-9 text-center text-[11px] font-semibold text-text-tertiary">{val > 0 ? '+' : ''}{val}</span>
              <div className="relative flex h-[120px] w-9 items-center justify-center">
                <input type="range" min={-10} max={10} step={1} value={val}
                  onChange={(e) => handleBandChange(i, parseInt(e.target.value))}
                  className="w-[120px]"
                  style={{ transform: 'rotate(-90deg)', accentColor: 'var(--accent)' }}
                />
              </div>
              <span className="text-[10px] text-text-tertiary">{BAND_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
