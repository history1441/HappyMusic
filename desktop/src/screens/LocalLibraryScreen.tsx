import { useState, useEffect } from 'react'
import { Music, Trash2, Loader2 } from 'lucide-react'
import { showToast } from '../components/Toast'
import { formatDuration } from '@common/utils/format'
import { usePlayerStore } from '../stores/playerStore'
import { getAllDownloads, getAllCache, removeDownload, removeCacheItem, type LocalSong } from '../services/cacheService'
import type { Song } from '@common/types'
import { cn } from '../utils/cn'

type TabType = 'downloads' | 'cache'

function localToSong(item: LocalSong): Song {
  return {
    song_name: item.song_name, singers: item.singers, album: item.album,
    ext: item.ext, file_size: String(item.file_size), duration: String(item.duration),
    duration_s: item.duration, source: item.source, song_identifier: item.song_identifier,
    download_url: item.file_path, cover_url: item.cover_url, lyric: '',
    with_valid_download_url: true,
  }
}

export default function LocalLibraryScreen() {
  const [tab, setTab] = useState<TabType>('downloads')
  const [downloads, setDownloads] = useState<LocalSong[]>([])
  const [cache, setCacheList] = useState<LocalSong[]>([])
  const [loading, setLoading] = useState(true)
  const playSong = usePlayerStore(s => s.playSong)

  const loadLibrary = async () => {
    setLoading(true)
    try {
      const [dl, ca] = await Promise.all([getAllDownloads(), getAllCache()])
      setDownloads(dl)
      setCacheList(ca)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadLibrary() }, [])

  const data = tab === 'downloads' ? downloads : cache

  const handlePlay = (item: LocalSong) => {
    playSong(localToSong(item), data.map(localToSong))
  }

  const handleDelete = async (item: LocalSong) => {
    if (!window.confirm(`删除 "${item.song_name}"？`)) return
    try {
      if (tab === 'downloads') {
        await removeDownload(item.source, item.song_identifier)
      } else {
        await removeCacheItem(item.source, item.song_identifier)
      }
      showToast('已删除', 'success')
      loadLibrary()
    } catch {
      showToast('删除失败', 'error')
    }
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex gap-2 p-3 flex-shrink-0">
        <button
          onClick={() => setTab('downloads')}
          className={cn(
            'flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all',
            tab === 'downloads'
              ? 'bg-primary border-primary text-white'
              : 'bg-card border-border text-text-secondary hover:border-primary/30',
          )}
        >
          下载 ({downloads.length})
        </button>
        <button
          onClick={() => setTab('cache')}
          className={cn(
            'flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all',
            tab === 'cache'
              ? 'bg-primary border-primary text-white'
              : 'bg-card border-border text-text-secondary hover:border-primary/30',
          )}
        >
          缓存 ({cache.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-text-tertiary text-sm">
            暂无{tab === 'downloads' ? '下载' : '缓存'}音乐
          </div>
        ) : (
          <div>
            {data.map((item, i) => (
              <div
                key={`${item.source}-${item.song_identifier}-${i}`}
                className="flex items-center px-4 py-2.5 border-b border-border-light bg-card hover:bg-border-light/50 transition-colors group"
              >
                <button
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                  onClick={() => handlePlay(item)}
                >
                  <div className="w-10 h-10 rounded bg-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.cover_url ? (
                      <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music size={18} className="text-text-tertiary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text truncate">{item.song_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-text-tertiary truncate">{item.singers}</p>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        tab === 'downloads'
                          ? 'bg-success/10 text-success'
                          : 'bg-primary/10 text-primary',
                      )}>
                        {tab === 'downloads' ? '已下载' : '已缓存'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-text-tertiary mr-2">{formatDuration(item.duration)}</span>
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="p-2 text-danger/60 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
