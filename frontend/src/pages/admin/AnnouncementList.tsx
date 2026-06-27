import { useEffect, useState } from 'react'
import api from '../../services/api'
import { Plus, Pin, Trash2, X } from 'lucide-react'

export default function AnnouncementList() {
  const [items, setItems] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', type: 'info', is_pinned: false, publish_at: '' })
  const token = localStorage.getItem('admin_token')
  const h = { headers: { Authorization: `Bearer ${token}` } }

  const fetch = () => api.get('/admin/announcements', h).then(r => setItems(r.data.items || []))
  useEffect(() => { fetch() }, [])

  const handleCreate = async () => {
    // publish_at 为空表示立即发布(传 null);否则转 ISO
    const payload = { ...form, publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : null }
    await api.post('/admin/announcements', payload, h)
    setForm({ title: '', content: '', type: 'info', is_pinned: false, publish_at: '' })
    setShowForm(false)
    fetch()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除此公告？')) return
    await api.delete(`/admin/announcements/${id}`, h)
    fetch()
  }

  const handlePin = async (id: number, pinned: boolean) => {
    await api.put(`/admin/announcements/${id}/pin`, null, { ...h, params: { pinned } })
    fetch()
  }

  const typeColors: any = { info: '#3b82f6', warning: '#f59e0b', update: '#10b981' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>公告管理</h2>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '8px 14px', background: 'var(--accent)', border: 'none',
          borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Plus size={14} /> 发布公告
        </button>
      </div>

      {showForm && (
        <div style={{
          padding: 20, marginBottom: 20, background: 'var(--card)', borderRadius: 'var(--radius)',
          border: '1px solid var(--accent)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 600 }}>新公告</span>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={16} /></button>
          </div>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="公告标题" style={{
              width: '100%', padding: '10px 12px', marginBottom: 8, background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }} />
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="公告内容" rows={3} style={{
              width: '100%', padding: '10px 12px', marginBottom: 8, background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{
              padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13,
            }}>
              <option value="info">通知</option>
              <option value="warning">警告</option>
              <option value="update">更新</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_pinned} onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })} />
              置顶
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
              定时:
              <input type="datetime-local" value={form.publish_at} onChange={(e) => setForm({ ...form, publish_at: e.target.value })} style={{
                padding: '4px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 12,
              }} />
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={handleCreate} style={{
              padding: '8px 16px', background: 'var(--accent)', border: 'none',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, marginLeft: 'auto',
            }}>发布</button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        {items.map((a) => (
          <div key={a.id} style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{a.title}</span>
                <span style={{
                  padding: '1px 8px', borderRadius: 10, fontSize: 10,
                  background: `${typeColors[a.type] || '#3b82f6'}20`,
                  color: typeColors[a.type] || '#3b82f6',
                }}>{a.type}</span>
                {a.publish_at ? (
                  <span style={{
                    padding: '1px 8px', borderRadius: 10, fontSize: 10,
                    background: a.is_published ? '#10b98120' : '#f59e0b20',
                    color: a.is_published ? '#10b981' : '#f59e0b',
                  }} title={a.publish_at ? `定时:${new Date(a.publish_at).toLocaleString('zh-CN')}` : ''}>
                    {a.is_published ? '已发布' : `定时 ${new Date(a.publish_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                ) : null}
                {a.is_pinned && <Pin size={12} style={{ color: '#f59e0b' }} />}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{a.content.substring(0, 100)}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => handlePin(a.id, !a.is_pinned)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                <Pin size={14} style={{ color: a.is_pinned ? '#f59e0b' : 'inherit' }} />
              </button>
              <button onClick={() => handleDelete(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>暂无公告</div>}
      </div>
    </div>
  )
}
