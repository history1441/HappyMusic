import { useEffect, useState } from 'react'
import api from '../../services/api'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function ApiMonitor() {
  const [endpoints, setEndpoints] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [errors, setErrors] = useState<any>({})
  const [hours, setHours] = useState(24)
  const token = localStorage.getItem('admin_token')
  const h = { headers: { Authorization: `Bearer ${token}` } }

  useEffect(() => {
    api.get(`/admin/monitor/response-times?hours=${hours}`, h).then(r => setEndpoints(r.data))
    api.get(`/admin/monitor/timeline?hours=${hours}`, h).then(r => setTimeline(r.data))
    api.get(`/admin/monitor/error-rates?hours=${hours}`, h).then(r => setErrors(r.data))
  }, [hours])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>API 监控</h2>
        <select value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{
          padding: '6px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13,
        }}>
          <option value={1}>1 小时</option>
          <option value={6}>6 小时</option>
          <option value={24}>24 小时</option>
          <option value={72}>3 天</option>
          <option value={168}>7 天</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: '总请求数', value: errors.total_requests?.toLocaleString() || '0', color: '#3b82f6' },
          { label: '错误率', value: `${errors.error_rate || 0}%`, color: (errors.error_rate || 0) > 5 ? '#ef4444' : '#10b981' },
          { label: '错误总数', value: ((errors.errors_4xx || 0) + (errors.errors_5xx || 0)).toString(), color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: 16, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>响应时间趋势</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
            <YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
            <Tooltip />
            <Area type="monotone" dataKey="avg_ms" stroke="#8b5cf6" fill="#8b5cf620" name="平均响应(ms)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>接口响应统计</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--bg-secondary)' }}>
            <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>端点</th>
            <th style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-tertiary)', fontWeight: 600 }}>请求数</th>
            <th style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-tertiary)', fontWeight: 600 }}>平均(ms)</th>
            <th style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-tertiary)', fontWeight: 600 }}>最大(ms)</th>
            <th style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-tertiary)', fontWeight: 600 }}>最小(ms)</th>
          </tr></thead>
          <tbody>
            {endpoints.map((e) => (
              <tr key={e.endpoint} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 14px', fontFamily: 'monospace' }}>{e.endpoint}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right' }}>{e.requests}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', color: e.avg_ms > 1000 ? '#ef4444' : e.avg_ms > 500 ? '#f59e0b' : '#10b981' }}>{e.avg_ms}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right' }}>{e.max_ms}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right' }}>{e.min_ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
