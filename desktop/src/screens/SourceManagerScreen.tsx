import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Music, Loader2 } from 'lucide-react'
import api, { getApiUrl, getCachedAccessToken } from '@common/services/api'
import { showToast } from '../components/Toast'

interface SourceInfo {
  id: string
  name: string
  enabled: boolean
}

const STORAGE_KEY = 'selected_sources.json'

async function loadSourcesFromBackend(): Promise<SourceInfo[]> {
  try {
    const token = getCachedAccessToken()
    const res = await fetch(`${getApiUrl()}/api/sources`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return (data.sources || []).filter((s: SourceInfo) => s.enabled)
  } catch (e) {
    console.warn('loadSourcesFromBackend failed:', e)
    return []
  }
}

function getSavedSelectedSources(available: SourceInfo[]): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data.sources)) return data.sources
    }
  } catch {}
  return available.map((s) => s.id)
}

function saveSelectedSourcesToStorage(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sources: ids }))
  } catch (e) {
    console.warn('saveSelectedSources failed:', e)
  }
}

export default function SourceManagerScreen() {
  const navigate = useNavigate()
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const available = await loadSourcesFromBackend()
      const saved = getSavedSelectedSources(available)
      setSources(available)
      setSelected(new Set(saved.length > 0 ? saved : available.map((s) => s.id)))
      setLoading(false)
    })()
  }, [])

  const toggleSource = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = () => {
    const ids = Array.from(selected)
    saveSelectedSourcesToStorage(ids)
    showToast('音乐源已保存', 'success')
    navigate(-1)
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1 text-text hover:text-primary transition-colors">
          <ArrowLeft size={22} />
        </button>
        <span className="text-lg font-bold">音乐源管理</span>
        <div className="w-6" />
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Source list */}
          <div className="flex-1 overflow-y-auto pb-20">
            <p className="text-xs text-text-tertiary px-4 pt-4 pb-2">
              选择搜索时使用的音乐源，仅显示服务端已启用的源
            </p>
            {sources.map((src) => (
              <div
                key={src.id}
                className="flex items-center justify-between px-4 py-3.5 bg-card border-b border-border-light"
              >
                <div className="flex items-center gap-2.5">
                  <Music size={20} className="text-primary flex-shrink-0" />
                  <span className="text-sm text-text">{src.name}</span>
                </div>
                {/* Checkbox-style toggle */}
                <button
                  onClick={() => toggleSource(src.id)}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    selected.has(src.id) ? 'bg-primary' : 'bg-border'
                  }`}
                  role="switch"
                  aria-checked={selected.has(src.id)}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                      selected.has(src.id) ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            ))}
            {sources.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-20">
                <Music size={48} className="text-border mb-3" />
                <p className="text-sm text-text-tertiary">暂无可用音乐源</p>
                <p className="text-xs text-border mt-1">请检查服务器配置</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-card border-t border-border">
            <span className="text-xs text-text-secondary">
              已选择 {selected.size} / {sources.length} 个源
            </span>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              保存
            </button>
          </div>
        </>
      )}
    </div>
  )
}
