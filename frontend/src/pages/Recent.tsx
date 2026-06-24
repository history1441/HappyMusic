import { useState, useEffect } from 'react'
import { useIsMobile } from '../hooks/useBreakpoint'
import { usePlayerStore } from '../stores/playerStore'
import { getRecent, clearRecent, type RecentRecord } from '../hooks/useDB'
import { Clock, Play, Trash2, Music2 } from 'lucide-react'
import type { Song } from '../types'

export default function Recent() {
  const isMobile = useIsMobile()
  const [records, setRecords] = useState<RecentRecord[]>([])
  const { play } = usePlayerStore()

  const fetch = async () => {
    const data = await getRecent()
    setRecords(data)
  }

  useEffect(() => { fetch() }, [])

  const playAll = () => {
    const songs: Song[] = records.map((r) => ({
      song_name: r.song_name, singers: r.singers, album: r.album,
      ext: r.ext, file_size: '', duration: '', duration_s: r.duration_s,
      source: r.source, song_identifier: r.song_identifier,
      download_url: '', cover_url: r.cover_url, lyric: r.lyric,
      with_valid_download_url: false,
    }))
    if (songs.length > 0) play(songs[0], songs)
  }

  const playOne = (r: RecentRecord) => {
    const song: Song = {
      song_name: r.song_name, singers: r.singers, album: r.album,
      ext: r.ext, file_size: '', duration: '', duration_s: r.duration_s,
      source: r.source, song_identifier: r.song_identifier,
      download_url: '', cover_url: r.cover_url, lyric: r.lyric,
      with_valid_download_url: false,
    }
    play(song)
  }

  const handleClear = async () => {
    await clearRecent()
    setRecords([])
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return `今天 ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return `昨天 ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={24} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>最近播放</h2>
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{records.length} 首</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {records.length > 0 && (
            <>
              <button onClick={playAll} style={{
                padding: '8px 20px', background: 'var(--accent)',
                border: 'none', borderRadius: 'var(--radius-sm)',
                color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              }}>
                <Play size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                播放全部
              </button>
              <button onClick={handleClear} style={{
                padding: '8px 16px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13,
              }}>
                <Trash2 size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                清空
              </button>
            </>
          )}
        </div>
      </div>

      {records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          <Music2 size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
          <p>还没有播放记录</p>
        </div>
      ) : (
        <div>
          {records.map((r, idx) => (
            <div
              key={`${r.source}-${r.song_identifier}-${idx}`}
              onClick={() => playOne(r)}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 40px 1fr 120px 100px',
                padding: '8px 12px', alignItems: 'center', gap: 12,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{idx + 1}</span>
              <div style={{
                width: 40, height: 40, borderRadius: 6,
                background: 'var(--bg-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {r.cover_url ? (
                  <img src={r.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Music2 size={16} style={{ color: 'var(--text-tertiary)' }} />
                )}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.song_name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.singers}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.source}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatTime(r.playedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
