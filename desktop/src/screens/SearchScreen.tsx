import { useState, useRef, useCallback, useEffect } from 'react'
import { getApiUrl, getCachedAccessToken } from '@common/services/api'
import { getSelectedSources, loadSourcesFromBackend } from '../services/sourceService'
import { addToFavorites, removeFromFavorites, loadPlaylistsCached, getFavPlaylistId } from '../services/playlistService'
import { addSearchHistory, getSearchHistory, clearSearchHistory } from '../services/searchHistoryService'
import { usePlayerStore } from '../stores/playerStore'
import type { Song } from '@common/types'
import { formatDuration } from '@common/utils/format'
import { Search, XCircle, Trash2, Loader2, Play, Pause, Disc3, Heart } from 'lucide-react'
import { showToast } from '../components/Toast'
import { cn } from '../utils/cn'

export default function SearchScreen() {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Song[]>([])
  const resultsRef = useRef<Song[]>([])
  const setResultsRef = useCallback((r: Song[]) => { resultsRef.current = r; setResults(r) }, [])
  const [loading, setLoading] = useState(false)
  const [streamStatus, setStreamStatus] = useState<string>('')
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(true)
  const [favSet, setFavSet] = useState<Set<string>>(new Set())
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const playSong = usePlayerStore(s => s.playSong)
  const currentSong = usePlayerStore(s => s.currentSong)
  const isPlaying = usePlayerStore(s => s.isPlaying)

  useEffect(() => {
    loadSourcesFromBackend().catch(() => {})
    loadSearchHistory()
    loadFavState()
  }, [])

  const loadSearchHistory = async () => {
    const history = await getSearchHistory()
    setSearchHistory(history)
  }

  const loadFavState = async () => {
    await loadPlaylistsCached()
    const favId = getFavPlaylistId()
    if (!favId) return
    try {
      const token = getCachedAccessToken()
      const res = await fetch(`${getApiUrl()}/api/playlists/${favId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        const keys = (data.songs || []).map((s: any) => `${s.source}:${s.song_identifier}`)
        setFavSet(new Set(keys))
      }
    } catch {}
  }

  const doSearch = useCallback(async (kw: string) => {
    if (!kw.trim()) return
    setLoading(true)
    setResultsRef([])
    setStreamStatus('搜索中...')
    setShowHistory(false)

    addSearchHistory(kw.trim()).catch(() => {})
    loadSearchHistory()

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const token = getCachedAccessToken()
      const sources = await getSelectedSources()
      const body: any = { keyword: kw.trim() }
      if (sources.length > 0) body.sources = sources

      const url = `${getApiUrl()}/api/search/stream`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error('不支持流式搜索')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const allResults: Song[] = []

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              if (data.songs && Array.isArray(data.songs)) {
                for (const song of data.songs) {
                  allResults.push(song)
                }
                setResultsRef([...allResults])
                setStreamStatus(`已找到 ${allResults.length} 条结果...`)
              } else if (data.done) {
                setStreamStatus(`搜索完成，共 ${allResults.length} 条结果`)
              }
            } catch {}
          }
        }
      } finally {
        reader.releaseLock()
      }

      if (allResults.length === 0) {
        setStreamStatus('没有找到相关歌曲')
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        try {
          const token = getCachedAccessToken()
          const sources = await getSelectedSources()
          const body: any = { keyword: kw.trim(), page: 1, page_size: 30 }
          if (sources.length > 0) body.sources = sources

          const res = await fetch(`${getApiUrl()}/api/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
          })
          if (res.ok) {
            const data = await res.json()
            setResultsRef(data.results || [])
            setStreamStatus(data.results?.length > 0 ? `共 ${data.total} 条结果` : '没有找到相关歌曲')
          } else {
            throw new Error('搜索失败')
          }
        } catch (e2: any) {
          showToast('搜索失败: ' + (e2.message || ''), 'error')
          setStreamStatus('搜索失败')
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInputChange = (value: string) => {
    setKeyword(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim()) {
      debounceRef.current = setTimeout(() => doSearch(value), 600)
    } else {
      setResultsRef([])
      setStreamStatus('')
      setShowHistory(true)
    }
  }

  const resultsRef = useRef<Song[]>([])
  const handlePlay = (song: Song) => {
    playSong(song, resultsRef.current)
  }

  const toggleFavorite = async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation()
    const key = `${song.source}:${song.song_identifier}`
    if (favSet.has(key)) {
      const ok = await removeFromFavorites(song.source, song.song_identifier)
      if (ok) {
        setFavSet(prev => { const next = new Set(prev); next.delete(key); return next })
        showToast('已取消喜欢', 'success')
      }
    } else {
      const ok = await addToFavorites(song)
      if (ok) {
        setFavSet(prev => { const next = new Set(prev); next.add(key); return next })
        showToast('已添加到喜欢', 'success')
      }
    }
  }

  const handleClearHistory = async () => {
    await clearSearchHistory()
    setSearchHistory([])
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search bar */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索歌曲、歌手、专辑"
            value={keyword}
            onChange={e => handleInputChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            autoFocus
          />
          {keyword && (
            <button
              onClick={() => { setKeyword(''); setResults([]); setStreamStatus(''); setShowHistory(true); inputRef.current?.focus() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text"
            >
              <XCircle size={18} />
            </button>
          )}
        </div>
        {streamStatus && (
          <p className="mt-2 text-xs text-text-secondary">{streamStatus}</p>
        )}
      </div>

      {/* Search history */}
      {showHistory && searchHistory.length > 0 && (
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text">搜索历史</span>
            <button onClick={handleClearHistory} className="text-xs text-text-tertiary hover:text-danger transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map(kw => (
              <button
                key={kw}
                onClick={() => { setKeyword(kw); doSearch(kw) }}
                className="px-3 py-1 bg-border-light rounded-full text-xs text-text-secondary hover:text-primary transition-colors"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && results.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : results.length > 0 ? (
          <div>
            {results.map((song, i) => {
              const isActive = currentSong?.source === song.source && currentSong?.song_identifier === song.song_identifier
              const isFav = favSet.has(`${song.source}:${song.song_identifier}`)
              return (
                <div
                  key={`${song.source}-${song.song_identifier}-${i}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 hover:bg-border-light transition-colors text-left border-b border-border-light cursor-pointer',
                    isActive && 'bg-primary-light/50'
                  )}
                  onClick={() => handlePlay(song)}
                >
                  <div className="w-10 h-10 rounded bg-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {song.cover_url ? (
                      <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Disc3 size={18} className="text-text-tertiary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm truncate', isActive ? 'text-primary font-medium' : 'text-text')}>
                      {song.song_name}
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      {song.singers}{song.album ? ` · ${song.album}` : ''}
                    </p>
                  </div>
                  <button onClick={(e) => toggleFavorite(e, song)} className={cn('p-1.5 transition-colors flex-shrink-0', isFav ? 'text-primary' : 'text-text-tertiary hover:text-primary')}>
                    <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePlay(song) }}
                    className="p-1.5 rounded-full hover:bg-border text-text-secondary hover:text-text transition-colors flex-shrink-0"
                  >
                    {isActive && isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  {song.duration_s > 0 && (
                    <span className="text-xs text-text-tertiary tabular-nums flex-shrink-0">
                      {formatDuration(song.duration_s)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ) : !loading && keyword.trim() && !showHistory ? (
          <div className="text-center py-12 text-text-tertiary text-sm">无搜索结果</div>
        ) : showHistory ? null : (
          <div className="flex flex-col items-center justify-center pt-24 text-text-tertiary">
            <Search size={48} className="text-border mb-3" />
            <p className="text-sm">输入关键词开始搜索</p>
          </div>
        )}
      </div>
    </div>
  )
}
