import { useState, useEffect } from 'react'
import { useAlarmStore, type Alarm } from '../stores/alarmStore'
import { useIsMobile } from '../hooks/useBreakpoint'
import { DAY_LABELS } from '../hooks/useAlarmChecker'
import api from '../services/api'
import type { Song } from '../types'
import { Plus, Trash2, Clock, Bell, Music2, X } from 'lucide-react'

export default function AlarmPage() {
  const isMobile = useIsMobile()
  const { alarms, addAlarm, removeAlarm, toggleAlarm } = useAlarmStore()
  const [showAdd, setShowAdd] = useState(false)
  const [favorites, setFavorites] = useState<Song[]>([])

  // 加载收藏用于选曲
  useEffect(() => {
    api.get('/playlists').then(({ data }) => {
      const fav = (data || []).find((p: any) => p.is_favorite)
      const songs = (fav?.songs || []).map((s: any) => ({
        song_name: s.song_name, singers: s.singers, album: s.album || '',
        ext: s.ext || 'mp3', file_size: '', duration: '', duration_s: s.duration,
        source: s.source, song_identifier: s.song_identifier,
        download_url: '', cover_url: s.cover_url || '', lyric: '', with_valid_download_url: false,
      } as Song))
      setFavorites(songs)
    }).catch(() => {})
  }, [])

  const daysText = (days: number[]) => {
    if (days.length === 0) return '每天'
    if (days.length === 7) return '每天'
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return '工作日'
    if (days.length === 2 && days.includes(0) && days.includes(6)) return '周末'
    return [...days].sort().map((d) => DAY_LABELS[d]).join(' ')
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={isMobile ? 20 : 24} style={{ color: 'var(--accent)' }} /> 音乐闹钟
        </h2>
        <button onClick={() => setShowAdd(true)} style={{
          padding: isMobile ? '6px 12px' : '8px 16px', background: 'var(--accent)',
          border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Plus size={14} /> 添加闹钟
        </button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20 }}>
        到点自动播放指定歌曲(需保持本页签打开)。未选歌曲则播放收藏第一首。
      </p>

      {alarms.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 60 }}>
          <Clock size={48} style={{ opacity: 0.4, marginBottom: 12 }} />
          <div>还没有闹钟,点击右上角添加</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alarms.map((a) => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              opacity: a.enabled ? 1 : 0.5,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: a.enabled ? 'var(--accent)' : 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {a.time}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {a.label || '闹钟'} · {daysText(a.days)}
                </div>
                {a.song && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Music2 size={11} /> {a.song.song_name} - {a.song.singers}
                  </div>
                )}
              </div>
              <button
                onClick={() => toggleAlarm(a.id)}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
                  background: a.enabled ? 'var(--accent)' : 'var(--bg-tertiary)', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3,
                  left: a.enabled ? 25 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
              <button onClick={() => removeAlarm(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddAlarmModal
          favorites={favorites}
          onClose={() => setShowAdd(false)}
          onAdd={(a) => { addAlarm(a); setShowAdd(false) }}
        />
      )}
    </div>
  )
}

function AddAlarmModal({ favorites, onClose, onAdd }: {
  favorites: Song[]
  onClose: () => void
  onAdd: (a: Omit<Alarm, 'id'>) => void
}) {
  const [time, setTime] = useState('07:30')
  const [label, setLabel] = useState('')
  const [days, setDays] = useState<number[]>([])
  const [songIdx, setSongIdx] = useState(-1)

  const toggleDay = (d: number) => {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  }

  const handleAdd = () => {
    onAdd({
      label: label.trim() || '闹钟',
      time,
      days: days.sort(),
      enabled: true,
      song: songIdx >= 0 && favorites[songIdx] ? favorites[songIdx] : null,
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380, padding: 24, background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>添加闹钟</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{
              fontSize: 32, fontWeight: 700, textAlign: 'center', padding: '8px 16px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)', fontFamily: 'monospace', outline: 'none',
            }} />
          </div>

          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="标签(如:起床)" style={{
            padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box', width: '100%',
          }} />

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>重复</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {DAY_LABELS.map((d, i) => (
                <button key={i} onClick={() => toggleDay(i)} style={{
                  flex: 1, padding: '6px 0', fontSize: 11, border: '1px solid',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  ...(days.includes(i)
                    ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                    : { background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }),
                }}>{d.slice(1)}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>铃声(留空=收藏第一首)</div>
            <select value={songIdx} onChange={(e) => setSongIdx(parseInt(e.target.value))} style={{
              width: '100%', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}>
              <option value={-1}>默认(收藏第一首)</option>
              {favorites.map((s, i) => (
                <option key={i} value={i}>{s.song_name} - {s.singers}</option>
              ))}
            </select>
          </div>

          <button onClick={handleAdd} style={{
            padding: '12px', background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}>保存</button>
        </div>
      </div>
    </div>
  )
}
