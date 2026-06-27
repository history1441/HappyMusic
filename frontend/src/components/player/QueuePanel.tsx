import { usePlayerStore } from '../../stores/playerStore'
import { X, ChevronUp, ChevronDown, Trash2, Play, Music2 } from 'lucide-react'

interface Props {
  onClose: () => void
}

/** 播放队列面板:展示当前队列,支持上移/下移/删除/点击跳转播放。 */
export default function QueuePanel({ onClose }: Props) {
  const { queue, queueIndex, moveInQueue, removeFromQueue, playQueueIndex, clearQueue } = usePlayerStore()

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 380,
      background: 'var(--card)', borderLeft: '1px solid var(--border)',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.1)', zIndex: 150,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>播放队列</h3>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{queue.length} 首</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {queue.length > 0 && (
            <button onClick={() => { if (confirm('清空播放队列?')) clearQueue() }} title="清空" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {queue.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', gap: 8 }}>
            <Music2 size={36} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 13 }}>播放队列为空</span>
          </div>
        ) : queue.map((song, i) => {
          const isCurrent = i === queueIndex
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              background: isCurrent ? 'var(--accent-light)' : 'transparent',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ width: 24, textAlign: 'center', flexShrink: 0 }}>
                {isCurrent ? <Play size={12} fill="currentColor" style={{ color: 'var(--accent)' }} /> : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{i + 1}</span>}
              </div>
              {song.cover_url ? (
                <img src={song.cover_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-tertiary)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => playQueueIndex(i)}>
                <div style={{
                  fontSize: 13, fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? 'var(--accent)' : 'var(--text-primary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{song.song_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.singers}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <button onClick={() => moveInQueue(i, i - 1)} disabled={i === 0} title="上移" style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: 'var(--text-tertiary)', padding: '1px', opacity: i === 0 ? 0.3 : 1, lineHeight: 0 }}>
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => moveInQueue(i, i + 1)} disabled={i === queue.length - 1} title="下移" style={{ background: 'none', border: 'none', cursor: i === queue.length - 1 ? 'default' : 'pointer', color: 'var(--text-tertiary)', padding: '1px', opacity: i === queue.length - 1 ? 0.3 : 1, lineHeight: 0 }}>
                  <ChevronDown size={14} />
                </button>
              </div>
              <button onClick={() => removeFromQueue(i)} title="移除" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
