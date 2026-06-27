import { useEffect, useState, useCallback } from 'react'
import api from '../../services/api'
import { Users, Play, Activity, RefreshCw, Clock } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface Overview {
  total_users: number; new_today: number; new_week: number; new_month: number
  total_plays: number; plays_today: number; active_users_7d: number
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [growth, setGrowth] = useState<{ date: string; count: number }[]>([])
  const [plays, setPlays] = useState<{ date: string; plays: number }[]>([])
  const [sources, setSources] = useState<{ source: string; count: number }[]>([])
  const [topSongs, setTopSongs] = useState<any[]>([])
  const [recentUsers, setRecentUsers] = useState<any[]>([])
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(() => {
    setRefreshing(true)
    const token = localStorage.getItem('admin_token')
    const h = { headers: { Authorization: `Bearer ${token}` } }
    Promise.all([
      api.get('/admin/analytics/overview', h).then(r => setOverview(r.data)),
      api.get('/admin/analytics/user-growth?days=30', h).then(r => setGrowth(r.data)),
      api.get('/admin/analytics/play-stats?days=14', h).then(r => setPlays(r.data)),
      api.get('/admin/analytics/source-distribution', h).then(r => setSources(r.data)),
      api.get('/global-hot?period=week&limit=10').then(r => setTopSongs(Array.isArray(r.data) ? r.data : [])),
      api.get('/admin/users?page=1&page_size=5', h).then(r => setRecentUsers(r.data.users || [])),
    ]).finally(() => setTimeout(() => setRefreshing(false), 300))
  }, [])

  useEffect(() => { load() }, [load])

  // 自动刷新(30秒)
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [autoRefresh, load])

  const cards = overview ? [
    { label: '总用户', value: overview.total_users, sub: `今日+${overview.new_today}`, icon: Users, color: '#3b82f6' },
    { label: '活跃用户(7天)', value: overview.active_users_7d, sub: `周增${overview.new_week}`, icon: Activity, color: '#10b981' },
    { label: '总播放量', value: overview.total_plays, sub: `今日${overview.plays_today}`, icon: Play, color: '#f59e0b' },
    { label: '月新增用户', value: overview.new_month, sub: '', icon: Users, color: '#8b5cf6' },
  ] : []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>管理仪表盘</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            自动刷新
          </label>
          <button onClick={load} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            刷新
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {cards.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} style={{
            padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{value?.toLocaleString()}</div>
                {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{sub}</div>}
              </div>
              <div style={{
                padding: 10, borderRadius: 'var(--radius-sm)',
                background: `${color}20`, color,
              }}>
                <Icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>用户注册趋势 (30天)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f620" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>每日播放量 (14天)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={plays}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
              <Tooltip />
              <Area type="monotone" dataKey="plays" stroke="#10b981" fill="#10b98120" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>音乐平台使用分布 (30天)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={sources}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="source" tick={{ fontSize: 11 }} stroke="var(--text-tertiary)" />
            <YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
            <Tooltip />
            <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        {/* 热门歌曲 Top10 */}
        <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Play size={14} style={{ color: 'var(--accent)' }} /> 热门歌曲 Top10 (周)
          </h3>
          <div>
            {topSongs.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: 12 }}>暂无数据</div>
            ) : topSongs.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ width: 22, textAlign: 'center', fontWeight: 700, color: i < 3 ? 'var(--accent)' : 'var(--text-tertiary)' }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.song_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.singers}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>▶ {s.plays || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 最近注册用户 */}
        <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} style={{ color: 'var(--accent)' }} /> 最近注册用户
          </h3>
          <div>
            {recentUsers.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: 12 }}>暂无数据</div>
            ) : recentUsers.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                  {(u.nickname || u.username || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nickname || u.username}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>@{u.username}</div>
                </div>
                {u.is_active === false && <span style={{ fontSize: 10, color: '#ef4444', border: '1px solid #ef4444', borderRadius: 4, padding: '1px 4px' }}>封禁</span>}
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
