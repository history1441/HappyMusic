import { useEffect, useState } from 'react'
import api from '../../services/api'
import { Database, Download, Wrench, RefreshCw } from 'lucide-react'

export default function DatabaseManager() {
  const [stats, setStats] = useState<any>(null)
  const [backups, setBackups] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const token = localStorage.getItem('admin_token')
  const h = { headers: { Authorization: `Bearer ${token}` } }

  const fetchData = async () => {
    api.get('/admin/database/stats', h).then(r => setStats(r.data))
    api.get('/admin/database/backups', h).then(r => setBackups(r.data.files || []))
  }

  useEffect(() => { fetchData() }, [])

  const handleBackup = async () => {
    setMessage('正在备份...')
    const { data } = await api.post('/admin/database/backup', null, h)
    setMessage(data.ok ? `备份成功: ${data.filename}` : `备份失败: ${data.error}`)
    fetchData()
    setTimeout(() => setMessage(''), 5000)
  }

  const handleOptimize = async () => {
    setMessage('正在优化...')
    await api.post('/admin/database/optimize', null, h)
    setMessage('优化完成')
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>数据库管理</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleBackup} style={{
            padding: '8px 14px', background: 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Database size={14} /> 创建备份
          </button>
          <button onClick={handleOptimize} style={{
            padding: '8px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Wrench size={14} /> 优化表
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '10px 14px', marginBottom: 16, borderRadius: 'var(--radius-sm)',
          background: '#10b98120', color: '#10b981', fontSize: 13,
        }}>{message}</div>
      )}

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <div style={{ padding: 16, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>数据库大小</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{stats.database_size_mb} MB</div>
          </div>
          <div style={{ padding: 16, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>表行数统计</div>
            {stats.tables && Object.entries(stats.tables).map(([table, count]) => (
              <div key={table} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <span>{table}</span><span style={{ fontWeight: 600 }}>{(count as number).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: 16, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>备份文件</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{backups.length}</div>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>备份列表</span>
          <button onClick={fetchData} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
            <RefreshCw size={14} />
          </button>
        </div>
        {backups.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>暂无备份</div>
        ) : backups.map((b) => (
          <div key={b.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{b.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{(b.size / 1024 / 1024).toFixed(2)} MB · {b.modified}</div>
            </div>
            <a href={`/api/admin/database/download/${b.name}`} download style={{
              padding: '4px 10px', background: 'var(--accent)', color: '#fff',
              borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Download size={12} /> 下载
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
