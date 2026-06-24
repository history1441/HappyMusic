import { useEffect, useState } from 'react'
import api from '../../services/api'
import { Save, RefreshCw, Eye, EyeOff } from 'lucide-react'

export default function EnvManager() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [edited, setEdited] = useState<Record<string, string>>({})
  const [reveal, setReveal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const token = localStorage.getItem('admin_token')
  const h = { headers: { Authorization: `Bearer ${token}` } }

  const fetchConfig = async (showSensitive = false) => {
    const { data } = await api.get('/admin/config', { ...h, params: { reveal: showSensitive } })
    setConfig(data)
    setEdited({})
  }

  useEffect(() => { fetchConfig() }, [])

  const handleSave = async () => {
    if (Object.keys(edited).length === 0) return
    setSaving(true)
    try {
      await api.put('/admin/config', { values: edited }, h)
      setMessage('配置已保存')
      fetchConfig(reveal)
    } catch (e: any) {
      setMessage(e.response?.data?.detail || '保存失败')
    }
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleReload = async () => {
    await api.post('/admin/config/reload', null, h)
    setMessage('配置已重新加载到运行时')
    setTimeout(() => setMessage(''), 3000)
  }

  const SENSITIVE = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN']

  // 配置项下拉选项映射
  const SELECT_OPTIONS: Record<string, { value: string; label: string }[]> = {
    AI_PROVIDER: [
      { value: 'openai', label: 'OpenAI (GPT-4 / GPT-3.5)' },
      { value: 'anthropic', label: 'Anthropic (Claude)' },
    ],
  }

  const currentVal = (key: string) => edited[key] !== undefined ? edited[key] : config[key]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>配置管理</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setReveal(!reveal); fetchConfig(!reveal) }} style={{
            padding: '8px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
            {reveal ? '隐藏敏感值' : '显示敏感值'}
          </button>
          <button onClick={handleReload} style={{
            padding: '8px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <RefreshCw size={14} /> 重新加载
          </button>
          <button onClick={handleSave} disabled={saving || Object.keys(edited).length === 0} style={{
            padding: '8px 14px', background: 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius-sm)', cursor: saving ? 'wait' : 'pointer',
            color: '#fff', fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Save size={14} /> 保存
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '10px 14px', marginBottom: 16, borderRadius: 'var(--radius-sm)',
          background: '#10b98120', color: '#10b981', fontSize: 13,
        }}>{message}</div>
      )}

      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {Object.entries(config).map(([key, _value]) => {
          const options = SELECT_OPTIONS[key]
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
              background: edited[key] !== undefined ? 'var(--accent-light)' : 'transparent',
            }}>
              <span style={{
                width: 280, flexShrink: 0, fontSize: 13, fontWeight: 500,
                fontFamily: 'monospace', color: SENSITIVE.some(s => key.toUpperCase().includes(s)) ? '#f59e0b' : 'var(--text-primary)',
              }}>{key}</span>
              {options ? (
                <select
                  value={currentVal(key)}
                  onChange={(e) => setEdited({ ...edited, [key]: e.target.value })}
                  style={{
                    flex: 1, padding: '6px 10px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)', borderRadius: 4,
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'monospace',
                    outline: 'none', cursor: 'pointer',
                  }}
                >
                  {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={currentVal(key)}
                  onChange={(e) => setEdited({ ...edited, [key]: e.target.value })}
                  style={{
                    flex: 1, padding: '6px 10px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)', borderRadius: 4,
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
