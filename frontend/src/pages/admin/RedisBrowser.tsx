import { useEffect, useState } from 'react'
import api from '../../services/api'
import { Search, Trash2 } from 'lucide-react'

export default function RedisBrowser() {
  const [stats, setStats] = useState<any>(null)
  const [keys, setKeys] = useState<any[]>([])
  const [pattern, setPattern] = useState('*')
  const [selectedKey, setSelectedKey] = useState<any>(null)
  const token = localStorage.getItem('admin_token')
  const h = { headers: { Authorization: `Bearer ${token}` } }

  const fetchStats = () => api.get('/admin/cache/stats', h).then(r => setStats(r.data))
  const fetchKeys = () => api.get('/admin/cache/keys', { ...h, params: { pattern } }).then(r => setKeys(r.data.keys))

  useEffect(() => { fetchStats(); fetchKeys() }, [])

  const handleDeleteKey = async (key: string) => {
    if (!confirm(`确认删除 key: ${key}?`)) return
    await api.delete(`/admin/cache/keys/${encodeURIComponent(key)}`, h)
    fetchKeys(); fetchStats()
  }

  const handleFlush = async () => {
    if (!confirm('确认清空所有缓存？此操作不可恢复')) return
    await api.post('/admin/cache/flush', null, { ...h, params: { confirm: true } })
    fetchKeys(); fetchStats()
  }

  const handleViewKey = async (key: string) => {
    const { data } = await api.get(`/admin/cache/keys/${encodeURIComponent(key)}`, h)
    setSelectedKey(data)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>缓存管理</h2>
        <button onClick={handleFlush} style={{
          padding: '8px 14px', background: '#ef4444', border: 'none',
          borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600,
        }}>清空缓存</button>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: '总键数', value: stats.total_keys },
            { label: '内存使用', value: stats.used_memory_human },
            { label: '命中次数', value: stats.keyspace_hits?.toLocaleString() },
            { label: '连接数', value: stats.connected_clients },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: 16, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input value={pattern} onChange={(e) => setPattern(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchKeys()}
          placeholder="搜索键名模式 (如 search:*)"
          style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
        <button onClick={fetchKeys} style={{ padding: '8px 14px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#fff', fontSize: 13 }}>
          <Search size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', maxHeight: 500, overflow: 'auto' }}>
          {keys.map((k) => (
            <div key={k.key} onClick={() => handleViewKey(k.key)} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
              background: selectedKey?.key === k.key ? 'var(--accent-light)' : 'transparent',
            }}>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{k.key}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>TTL: {k.ttl}s</span>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteKey(k.key) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {keys.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>无缓存数据</div>}
        </div>
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: 16 }}>
          {selectedKey ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, fontFamily: 'monospace' }}>{selectedKey.key}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>类型: {selectedKey.type} · TTL: {selectedKey.ttl}s</div>
              <pre style={{
                padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
                fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)',
                maxHeight: 350, overflow: 'auto', whiteSpace: 'pre-wrap',
              }}>{typeof selectedKey.value === 'string' ? selectedKey.value.substring(0, 2000) : JSON.stringify(selectedKey.value, null, 2)}</pre>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>点击左侧键名查看值</div>
          )}
        </div>
      </div>
    </div>
  )
}
