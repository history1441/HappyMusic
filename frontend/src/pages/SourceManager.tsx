import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { ArrowLeft, Music2, Loader } from 'lucide-react'

const SOURCES_STORAGE_KEY = 'selected_search_sources'

interface SourceInfo {
  id: string
  name: string
  enabled: boolean
}

export default function SourceManager() {
  const navigate = useNavigate()
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/sources').then(({ data }) => {
      const enabled: SourceInfo[] = (data.sources || []).filter((s: SourceInfo) => s.enabled)
      setSources(enabled)
      const saved: string[] = JSON.parse(localStorage.getItem(SOURCES_STORAGE_KEY) || '[]')
      setSelected(new Set(saved.length > 0 ? saved : enabled.map(s => s.id)))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = () => {
    setSaving(true)
    const ids = Array.from(selected)
    localStorage.setItem(SOURCES_STORAGE_KEY, JSON.stringify(ids))
    setTimeout(() => {
      setSaving(false)
      navigate(-1)
    }, 300)
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>
        <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', padding: 4,
        }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>音乐源管理</h2>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
        选择搜索时使用的音乐源。仅显示服务端已启用的源。
      </p>

      {sources.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
          <Music2 size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p>暂无可用音乐源，请检查服务器配置</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          {sources.map(src => (
            <div key={src.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', background: 'var(--card)',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Music2 size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>{src.name}</span>
              </div>
              <button onClick={() => toggle(src.id)} style={{
                width: 44, height: 24, borderRadius: 12,
                background: selected.has(src.id) ? 'var(--accent)' : 'var(--bg-tertiary)',
                border: 'none', cursor: 'pointer',
                position: 'relative', transition: 'background 0.2s',
              }}>
                <span style={{
                  position: 'absolute', top: 2,
                  left: selected.has(src.id) ? 22 : 2,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          已选择 {selected.size} / {sources.length} 个源
        </span>
        <button onClick={handleSave} disabled={saving} style={{
          padding: '10px 28px', background: 'var(--accent)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-sm)',
          cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600,
          fontSize: 14, opacity: saving ? 0.7 : 1,
        }}>
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
