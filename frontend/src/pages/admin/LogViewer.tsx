import { useEffect, useState } from 'react'
import api from '../../services/api'

export default function LogViewer() {
  const [logs, setLogs] = useState<string[]>([])
  const [level, setLevel] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const token = localStorage.getItem('admin_token')
  const h = { headers: { Authorization: `Bearer ${token}` } }

  const fetchLogs = () => {
    api.get('/admin/logs', { ...h, params: { lines: 200, level } }).then(r => setLogs(r.data.logs || []))
  }

  useEffect(() => { fetchLogs(); const iv = setInterval(fetchLogs, 5000); return () => clearInterval(iv) }, [level])

  useEffect(() => {
    if (autoScroll) {
      const el = document.getElementById('log-container')
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [logs])

  const getColor = (line: string) => {
    if (line.includes('ERROR')) return '#ef4444'
    if (line.includes('WARNING')) return '#f59e0b'
    if (line.includes('INFO')) return 'var(--text-secondary)'
    return 'var(--text-tertiary)'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>日志查看</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={level} onChange={(e) => setLevel(e.target.value)} style={{
            padding: '6px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13,
          }}>
            <option value="">全部</option>
            <option value="ERROR">ERROR</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
            自动滚动
          </label>
        </div>
      </div>

      <div id="log-container" style={{
        background: '#1a1a2e', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
        padding: 16, maxHeight: 'calc(100vh - 200px)', overflow: 'auto', fontFamily: 'monospace', fontSize: 12,
      }}>
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 40 }}>暂无日志</div>
        ) : logs.map((line, i) => (
          <div key={i} style={{ color: getColor(line), marginBottom: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}
