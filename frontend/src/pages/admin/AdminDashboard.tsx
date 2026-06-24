import { useEffect, useState } from 'react'
import api from '../../services/api'
import { Users, Play, Activity } from 'lucide-react'
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

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    const h = { headers: { Authorization: `Bearer ${token}` } }
    api.get('/admin/analytics/overview', h).then(r => setOverview(r.data))
    api.get('/admin/analytics/user-growth?days=30', h).then(r => setGrowth(r.data))
    api.get('/admin/analytics/play-stats?days=14', h).then(r => setPlays(r.data))
    api.get('/admin/analytics/source-distribution', h).then(r => setSources(r.data))
  }, [])

  const cards = overview ? [
    { label: '总用户', value: overview.total_users, sub: `今日+${overview.new_today}`, icon: Users, color: '#3b82f6' },
    { label: '活跃用户(7天)', value: overview.active_users_7d, sub: `周增${overview.new_week}`, icon: Activity, color: '#10b981' },
    { label: '总播放量', value: overview.total_plays, sub: `今日${overview.plays_today}`, icon: Play, color: '#f59e0b' },
    { label: '月新增用户', value: overview.new_month, sub: '', icon: Users, color: '#8b5cf6' },
  ] : []

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>管理仪表盘</h2>
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
    </div>
  )
}
