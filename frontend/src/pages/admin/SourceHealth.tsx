import { useEffect, useState } from 'react'
import api from '../../services/api'
import { RefreshCw, Music } from 'lucide-react'

export default function SourceHealth() {
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const token = localStorage.getItem('admin_token')
  const h = { headers: { Authorization: `Bearer ${token}` } }

  const fetchStats = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/sources/stats', h)
      setSources(data.sources || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchStats() }, [])

  const SOURCE_NAMES: Record<string, string> = {
    netease: '网易云音乐', qqmusic: 'QQ音乐', kugou: '酷狗音乐',
    kuwo: '酷我音乐', migu: '咪咕音乐',
  }

  const total = sources.reduce((s: number, r: any) => s + (r.count || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>音乐源统计</h2>
        <button onClick={fetchStats} disabled={loading} style={{
          padding: '8px 14px', background: 'var(--accent)', border: 'none',
          borderRadius: 'var(--radius-sm)', cursor: loading ? 'wait' : 'pointer',
          color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? '加载中...' : '刷新'}
        </button>
      </div>

      <div style={{ padding: 16, marginBottom: 16, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>总播放记录数</div>
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{total.toLocaleString()}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {sources.map((s) => {
          const pct = total > 0 ? ((s.count / total) * 100).toFixed(1) : '0'
          return (
            <div key={s.source} style={{
              padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Music size={18} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{SOURCE_NAMES[s.source] || s.source}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{pct}%</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{(s.count || 0).toLocaleString()}</div>
              <div style={{ marginTop: 8, height: 4, background: 'var(--bg-secondary)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2, minWidth: pct === '0' ? 0 : 4 }} />
              </div>
            </div>
          )
        })}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
