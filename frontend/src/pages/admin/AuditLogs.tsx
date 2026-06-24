import { useEffect, useState } from 'react'
import api from '../../services/api'
import {
  Search, ChevronLeft, ChevronRight, Shield,
  CheckCircle, XCircle, Download, Trash2, Eye, BarChart3,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'

const ACTION_LABELS: Record<string, string> = {
  login: '用户登录', admin_login: '管理员登录', register: '注册',
  search: '搜索', play: '播放', playlist: '歌单', share: '分享',
  lyrics: '歌词', download: '下载', admin_op: '管理操作',
  guess_game: '猜歌', ai_request: 'AI请求', sync: '同步', api_request: 'API请求',
}
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export default function AuditLogs() {
  const [tab, setTab] = useState<'logs' | 'logins' | 'stats'>('logs')
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState<any>(null)
  const [filters, setFilters] = useState({
    action: '', username: '', search: '', success: '' as string,
  })
  const pageSize = 20
  const token = localStorage.getItem('admin_token')
  const h = { headers: { Authorization: `Bearer ${token}` } }

  const fetchLogs = async (p = page) => {
    const params: any = { page: p, page_size: pageSize, ...filters }
    if (params.success === '') delete params.success
    const { data } = await api.get('/admin/audit/logs', { params, ...h })
    setLogs(data.logs || [])
    setTotal(data.total)
  }

  const fetchStats = async () => {
    const { data } = await api.get('/admin/audit/stats', h)
    setStats(data)
  }

  const fetchLogins = async (p = page) => {
    const params: any = { page: p, page_size: pageSize, action: 'login,admin_login,qrcode_scan,qrcode_login' }
    if (filters.username) params.username = filters.username
    if (filters.success !== '') params.success = filters.success === 'true'
    const { data } = await api.get('/admin/audit/logs', { params, ...h })
    setLogs(data.logs || [])
    setTotal(data.total)
  }

  useEffect(() => {
    if (tab === 'logs') fetchLogs()
    else if (tab === 'logins') fetchLogins()
    else fetchStats()
  }, [page, tab])

  const handleCleanup = async () => {
    if (!confirm('确认清理90天前的审计日志？此操作不可恢复')) return
    const { data } = await api.delete('/admin/audit/cleanup', h)
    alert(data.message)
    fetchLogs()
  }

  const handleExport = () => {
    const csv = ['ID,用户,操作,路径,状态码,成功,IP,时间']
    logs.forEach(l => {
      csv.push(`${l.id},${l.username},${ACTION_LABELS[l.action] || l.action},${l.request_path},${l.status_code},${l.success ? '是' : '否'},${l.ip_address},${l.created_at}`)
    })
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>审计日志</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExport} style={{
            padding: '6px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 4,
          }}><Download size={12} /> 导出CSV</button>
          <button onClick={handleCleanup} style={{
            padding: '6px 12px', background: '#ef444420', border: '1px solid #ef4444',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#ef4444', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 4,
          }}><Trash2 size={12} /> 清理90天前日志</button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-secondary)', padding: 4, borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>
        {[
          { key: 'logs' as const, label: '操作日志', icon: Shield },
          { key: 'logins' as const, label: '登录日志', icon: Eye },
          { key: 'stats' as const, label: '统计分析', icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setTab(key); setPage(1) }} style={{
            padding: '8px 16px', background: tab === key ? 'var(--accent)' : 'transparent',
            border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            color: tab === key ? '#fff' : 'var(--text-tertiary)', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}><Icon size={14} /> {label}</button>
        ))}
      </div>

      {/* 筛选栏 */}
      {tab !== 'stats' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {tab === 'logs' && (
            <select value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })}
              style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}>
              <option value="">全部操作</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          <input value={filters.username} onChange={e => setFilters({ ...filters, username: e.target.value })}
            placeholder="用户名" style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12, width: 120 }} />
          <input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })}
            placeholder="搜索详情/IP/路径" style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12, width: 180 }} />
          <select value={filters.success} onChange={e => setFilters({ ...filters, success: e.target.value })}
            style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}>
            <option value="">全部状态</option>
            <option value="true">成功</option>
            <option value="false">失败</option>
          </select>
          <button onClick={() => { setPage(1); tab === 'logs' ? fetchLogs(1) : fetchLogins(1) }} style={{
            padding: '6px 14px', background: 'var(--accent)', border: 'none', borderRadius: 4,
            color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
          }}><Search size={12} /> 筛选</button>
        </div>
      )}

      {/* 统计分析 */}
      {tab === 'stats' && stats && (
        <div>
          {/* 概览卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: '总操作数', value: stats.success_count + stats.fail_count, color: '#3b82f6' },
              { label: '成功操作', value: stats.success_count, color: '#10b981' },
              { label: '失败操作', value: stats.fail_count, color: '#ef4444' },
              { label: '失败率', value: stats.fail_count + stats.success_count > 0 ? ((stats.fail_count / (stats.fail_count + stats.success_count)) * 100).toFixed(1) + '%' : '0%', color: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} style={{ padding: 16, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>每日操作趋势</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.daily_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="#3b82f620" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>每日登录趋势</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.login_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" stroke="#10b981" fill="#10b98120" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>操作类型分布</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={stats.action_distribution.map((a: any) => ({ name: ACTION_LABELS[a.action] || a.action, value: a.count }))}
                    dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {stats.action_distribution.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>TOP 活跃用户</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.top_users} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
                  <YAxis dataKey="username" type="category" tick={{ fontSize: 10 }} width={80} stroke="var(--text-tertiary)" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 登录失败IP */}
          {stats.fail_ips && stats.fail_ips.length > 0 && (
            <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>登录失败 TOP IP</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {stats.fail_ips.map((f: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#ef444410', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                    <span style={{ color: '#ef4444', fontWeight: 500 }}>{f.ip}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{f.count}次</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 最近登录 */}
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>最近登录记录</div>
            {stats.recent_logins.map((l: any) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                {l.success ? <CheckCircle size={14} style={{ color: '#10b981' }} /> : <XCircle size={14} style={{ color: '#ef4444' }} />}
                <span style={{ fontWeight: 500, fontSize: 13, width: 100 }}>{l.username || '-'}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 80 }}>{ACTION_LABELS[l.action] || l.action}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flex: 1 }}>{l.ip_address}</span>
                <span style={{ fontSize: 12, color: l.success ? '#10b981' : '#ef4444' }}>{l.success ? '成功' : '失败'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 140 }}>{l.created_at ? new Date(l.created_at).toLocaleString() : '-'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 日志表格 */}
      {tab !== 'stats' && (
        <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: 'var(--bg-secondary)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>ID</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>用户</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>操作</th>
              {tab === 'logs' && <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>路径</th>}
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>IP</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>状态</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>耗时</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>详情</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>时间</th>
            </tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}>{l.id}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{l.username || (l.user_id ? `用户#${l.user_id}` : '-')}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, background: 'var(--bg-secondary)', fontWeight: 500 }}>
                      {ACTION_LABELS[l.action] || l.action}
                    </span>
                  </td>
                  {tab === 'logs' && <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.request_path}</td>}
                  <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)' }}>{l.ip_address}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {l.success ? <CheckCircle size={12} style={{ color: '#10b981' }} /> : <XCircle size={12} style={{ color: '#ef4444' }} />}
                      <span style={{ color: l.success ? '#10b981' : '#ef4444', fontSize: 11 }}>{l.status_code}</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)' }}>
                    {l.response_ms != null ? (l.response_ms >= 1000 ? `${(l.response_ms / 1000).toFixed(2)}s` : `${Math.round(l.response_ms)}ms`) : '-'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.detail}>{l.detail || '-'}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: 11 }}>{l.created_at ? new Date(l.created_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      {tab !== 'stats' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>共 {total} 条 · 第 {page}/{totalPages || 1} 页</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '6px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: page <= 1 ? 'not-allowed' : 'pointer', color: 'var(--text-primary)', opacity: page <= 1 ? 0.5 : 1 }}><ChevronLeft size={14} /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: '6px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: 'var(--text-primary)', opacity: page >= totalPages ? 0.5 : 1 }}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
