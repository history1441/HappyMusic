import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, HardDrive, Trash2, Loader2 } from 'lucide-react'
import { showToast } from '../components/Toast'
import { formatSize } from '@common/utils/format'
import { getAllDownloads, getAllCache, removeDownload, removeCacheItem, type LocalSong } from '../services/cacheService'

export default function StorageScreen() {
  const navigate = useNavigate()
  const [downloadSize, setDownloadSize] = useState(0)
  const [cacheSize, setCacheSize] = useState(0)
  const [cache, setCache] = useState<LocalSong[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStorage() }, [])

  const loadStorage = async () => {
    setLoading(true)
    try {
      const [downloads, cached] = await Promise.all([getAllDownloads(), getAllCache()])
      setDownloadSize(downloads.reduce((sum, s) => sum + (s.file_size || 0), 0))
      setCacheSize(cached.reduce((sum, s) => sum + (s.file_size || 0), 0))
      setCache(cached)
    } catch {}
    setLoading(false)
  }

  const handleClearCache = async () => {
    if (!window.confirm('确定清除所有缓存音乐？')) return
    try {
      for (const item of cache) {
        await removeCacheItem(item.source, item.song_identifier)
      }
      showToast('已清除所有缓存', 'success')
      loadStorage()
    } catch {
      showToast('清除失败', 'error')
    }
  }

  const handleDeleteCacheItem = async (item: LocalSong) => {
    if (!window.confirm(`删除缓存 "${item.song_name}"？`)) return
    try {
      await removeCacheItem(item.source, item.song_identifier)
      showToast('已删除', 'success')
      loadStorage()
    } catch {
      showToast('删除失败', 'error')
    }
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-bg">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
          <button onClick={() => navigate(-1)} className="p-1.5 text-text-secondary hover:text-text transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="flex-1 text-center text-base font-bold text-text">存储空间</h1>
          <div className="w-5" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      </div>
    )
  }

  const totalUsed = downloadSize + cacheSize

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 text-text-secondary hover:text-text transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-text">存储空间</h1>
        <div className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-base font-bold text-text mb-3">空间占用</h2>
          <div className="flex items-center gap-2 mt-2">
            <HardDrive size={16} className="text-primary flex-shrink-0" />
            <span className="text-sm text-text-secondary">下载音乐:</span>
            <span className="text-sm text-text font-medium ml-auto">{formatSize(downloadSize)}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <HardDrive size={16} className="text-primary/60 flex-shrink-0" />
            <span className="text-sm text-text-secondary">缓存音乐:</span>
            <span className="text-sm text-text font-medium ml-auto">{formatSize(cacheSize)}</span>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
            <span className="text-sm text-text font-medium">总计占用:</span>
            <span className="text-sm text-primary font-bold ml-auto">{formatSize(totalUsed)}</span>
          </div>
        </div>

        <button
          onClick={handleClearCache}
          disabled={cache.length === 0}
          className="w-full py-3.5 rounded-xl bg-danger text-white text-sm font-semibold hover:bg-danger/90 transition-colors disabled:opacity-40"
        >
          一键清除缓存 ({cache.length})
        </button>

        <div>
          <h3 className="text-sm font-bold text-text mb-2">缓存音乐 ({cache.length})</h3>
          {cache.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary text-sm">暂无缓存</div>
          ) : (
            <div className="space-y-1.5">
              {cache.map((item, i) => (
                <div key={`${item.source}-${item.song_identifier}-${i}`} className="flex items-center bg-card border border-border rounded-lg px-3 py-2.5 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text truncate">{item.song_name}</p>
                    <p className="text-xs text-text-tertiary mt-0.5">{item.singers} · {formatSize(item.file_size)}</p>
                  </div>
                  <button onClick={() => handleDeleteCacheItem(item)} className="ml-3 p-1.5 text-danger/60 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
