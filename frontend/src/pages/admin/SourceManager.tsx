import { useState, useEffect } from 'react'
import adminApi from '../../services/adminApi'

interface Source {
  id: string
  name: string
  client: string
  enabled: boolean
}

interface TestResult {
  source_id: string
  source_name: string
  success: boolean
  count?: number
  elapsed?: number
  error?: string
  sample?: any[]
}

export default function SourceManager() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})

  const loadSources = async () => {
    try {
      const { data } = await adminApi.get('/sources/list')
      setSources(data.sources || [])
    } catch (e: any) {
      console.error('Failed to load sources:', e?.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSources() }, [])

  const toggleSource = async (source: Source) => {
    const newEnabled = !source.enabled
    try {
      await adminApi.put('/sources/toggle', { source_id: source.id, enabled: newEnabled })
      setSources(prev => prev.map(s => s.id === source.id ? { ...s, enabled: newEnabled } : s))
    } catch (e: any) {
      alert(`操作失败: ${e?.response?.data?.detail || e?.message}`)
    }
  }

  const testSource = async (source: Source) => {
    setTesting(source.id)
    try {
      const { data } = await adminApi.post('/sources/test', { source_id: source.id, keyword: '周杰伦' })
      setTestResults(prev => ({ ...prev, [source.id]: data }))
    } catch (e: any) {
      setTestResults(prev => ({
        ...prev,
        [source.id]: { source_id: source.id, source_name: source.name, success: false, error: e?.message },
      }))
    } finally {
      setTesting(null)
    }
  }

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>加载中...</div>
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>音乐源管理</h2>
        <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          已启用 {sources.filter(s => s.enabled).length} / {sources.length} 个源
        </span>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {sources.map(source => {
          const test = testResults[source.id]
          return (
            <div key={source.id} style={{
              background: 'var(--bg-secondary)',
              borderRadius: 8,
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: `1px solid ${source.enabled ? 'var(--border-primary)' : 'var(--border-primary)'}`,
              opacity: source.enabled ? 1 : 0.7,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>{source.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{source.client}</span>
                  <span style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: source.enabled ? '#dcfce7' : '#f3f4f6',
                    color: source.enabled ? '#16a34a' : '#9ca3af',
                    fontWeight: 500,
                  }}>
                    {source.enabled ? '已启用' : '已禁用'}
                  </span>
                </div>
                {test && (
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    {test.success ? (
                      <span style={{ color: '#16a34a' }}>
                        测试通过: {test.count} 首歌曲, 耗时 {test.elapsed}s
                      </span>
                    ) : (
                      <span style={{ color: '#ef4444' }}>
                        测试失败: {test.error}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => testSource(source)}
                  disabled={!!testing}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--border-primary)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    cursor: testing ? 'wait' : 'pointer',
                    fontSize: 13,
                  }}
                >
                  {testing === source.id ? '测试中...' : '测试'}
                </button>
                <button
                  onClick={() => toggleSource(source)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: source.enabled ? '#ef4444' : '#16a34a',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {source.enabled ? '禁用' : '启用'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
