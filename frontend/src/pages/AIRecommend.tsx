import { useState, useEffect } from 'react'
import { useIsMobile } from '../hooks/useBreakpoint'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import type { Song } from '../types'
import { Sparkles, Play, Music2, RefreshCw, Zap, Brain } from 'lucide-react'

/** 带并发上限的 Promise.all 实现 */
async function promisePool<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: (R | undefined)[] = new Array(items.length)
  let currentIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++
      try { results[idx] = await fn(items[idx], idx) } catch { results[idx] = undefined }
    }
  })
  await Promise.all(workers)
  return results as R[]
}

interface Recommendation {
  song: string
  artist: string
  reason: string
}

export default function AIRecommend() {
  const isMobile = useIsMobile()
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [searchResults, setSearchResults] = useState<Map<string, Song[]>>(new Map())
  const [expandedSong, setExpandedSong] = useState<string | null>(null)
  const { play } = usePlayerStore()

  useEffect(() => {
    api.get('/ai/status').then(({ data }) => setAiEnabled(data.enabled))
  }, [])

  const fetchRecommendations = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/ai/recommend')
      setRecs(data.recommendations || [])
      // Try to match each recommendation with actual songs (max 3 concurrent)
      const matched = await promisePool(
        (data.recommendations || []).slice(0, 5),
        async (rec) => {
          try {
            const { data: searchData } = await api.post('/search', {
              keyword: `${rec.song} ${rec.artist}`,
            })
            return { key: `${rec.song}-${rec.artist}`, results: searchData.results || [] }
          } catch {
            return { key: `${rec.song}-${rec.artist}`, results: [] }
          }
        },
        3,
      )
      const resultsMap = new Map<string, Song[]>()
      for (const m of matched) {
        resultsMap.set(m.key, m.results)
      }
      setSearchResults(resultsMap)
    } catch {
      setRecs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecommendations()
  }, [])

  const handlePlay = (rec: Recommendation) => {
    const key = `${rec.song}-${rec.artist}`
    const songs = searchResults.get(key) || []
    if (songs.length > 0) {
      play(songs[0], songs)
    }
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={24} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>AI 推荐</h2>
          {aiEnabled && (
            <span style={{
              padding: '2px 8px', background: 'rgba(52,199,89,0.1)',
              borderRadius: 10, fontSize: 11, color: '#34C759', fontWeight: 600,
            }}>
              <Brain size={10} style={{ marginRight: 2, verticalAlign: -1 }} />
              AI已启用
            </span>
          )}
        </div>
        <button onClick={fetchRecommendations} disabled={loading} style={{
          padding: '8px 16px', background: 'var(--bg-secondary)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          换一批
        </button>
      </div>

      {!aiEnabled && (
        <div style={{
          padding: 20, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Zap size={20} style={{ color: '#FF9500' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>AI 功能未配置</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              当前使用基于播放历史的智能推荐。配置 OpenAI 兼容 API 后可获得更精准的 AI 推荐。
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 64 }}>
          <Sparkles size={48} style={{ color: 'var(--accent)', marginBottom: 16, animation: 'pulse 1.5s infinite' }} />
          <p style={{ color: 'var(--text-tertiary)' }}>AI 正在分析你的听歌偏好...</p>
        </div>
      )}

      {!loading && recs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {recs.map((rec, i) => {
            const key = `${rec.song}-${rec.artist}`
            const songs = searchResults.get(key) || []
            const expanded = expandedSong === key
            return (
              <div key={i} style={{
                background: 'var(--card)', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', overflow: 'hidden',
              }}>
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: `linear-gradient(135deg, var(--accent), ${['#FF9500', '#34C759', '#5856D6', '#FF2D55', '#5AC8FA', '#FFCC00'][i % 6]})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: 20, flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{rec.song}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{rec.artist}</div>
                    {rec.reason && (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontStyle: 'italic' }}>
                        {rec.reason}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handlePlay(rec)} disabled={songs.length === 0} style={{
                      padding: '8px 16px', background: 'var(--accent)',
                      border: 'none', borderRadius: 'var(--radius-sm)',
                      color: '#fff', cursor: songs.length > 0 ? 'pointer' : 'not-allowed',
                      fontWeight: 600, fontSize: 13, opacity: songs.length > 0 ? 1 : 0.5,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Play size={14} />播放
                    </button>
                    {songs.length > 1 && (
                      <button onClick={() => setExpandedSong(expanded ? null : key)} style={{
                        padding: '8px 12px', background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12,
                      }}>
                        {songs.length}个版本
                      </button>
                    )}
                  </div>
                </div>
                {expanded && songs.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '8px 20px 12px' }}>
                    {songs.slice(0, 5).map((s, j) => (
                      <div key={j} onClick={() => play(s, songs)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                          fontSize: 13,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Music2 size={12} style={{ color: 'var(--text-tertiary)' }} />
                        <span>{s.source}</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{s.ext.toUpperCase()}</span>
                        {s.with_valid_download_url && <span style={{ color: '#34C759', fontSize: 11 }}>可下载</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && recs.length === 0 && (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          <Sparkles size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p>播放更多歌曲后，AI 会为你生成个性化推荐</p>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
