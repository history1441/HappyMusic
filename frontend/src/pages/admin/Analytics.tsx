import { useEffect, useState } from 'react'
import api from '../../services/api'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

export default function Analytics() {
  const [plays, setPlays] = useState<any[]>([])
  const [growth, setGrowth] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [topSongs, setTopSongs] = useState<any[]>([])
  const [platforms, setPlatforms] = useState<any[]>([])
  const [days, setDays] = useState(30)
  const token = localStorage.getItem('admin_token')
  const h = { headers: { Authorization: `Bearer ${token}` } }

  useEffect(() => {
    api.get(`/admin/analytics/play-stats?days=${days}`, h).then(r => setPlays(r.data))
    api.get(`/admin/analytics/user-growth?days=${days}`, h).then(r => setGrowth(r.data))
    api.get('/admin/analytics/source-distribution', h).then(r => setSources(r.data))
    api.get(`/admin/analytics/top-songs?days=${days}&limit=10`, h).then(r => setTopSongs(r.data))
    api.get('/admin/analytics/platform-distribution', h).then(r => setPlatforms(r.data)).catch(() => setPlatforms([]))
  }, [days])

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
  const PLATFORM_LABELS: Record<string, string> = { web: 'Web浏览器', android: 'Android', ios: 'iOS', windows: 'Windows PC', mac: 'macOS', unknown: '未知' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>数据分析</h2>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ padding: '6px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13 }}>
          <option value={7}>最近 7 天</option><option value={30}>最近 30 天</option><option value={90}>最近 90 天</option><option value={365}>最近 1 年</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>播放趋势</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={plays}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" /><YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" /><Tooltip /><Area type="monotone" dataKey="plays" stroke="#10b981" fill="#10b98120" /></AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>用户增长</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={growth}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" /><YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" /><Tooltip /><Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f620" /></AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>音乐平台分布</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={sources} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={70} label>{sources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>客户端平台分布</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={platforms.map(p => ({ name: PLATFORM_LABELS[p.platform] || p.platform, value: p.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>{platforms.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>热门歌曲</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topSongs} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis type="number" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" /><YAxis dataKey="song_name" type="category" tick={{ fontSize: 9 }} width={80} stroke="var(--text-tertiary)" /><Tooltip /><Bar dataKey="plays" fill="#8b5cf6" radius={[0, 4, 4, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
