import { useState, useRef, useEffect, useCallback } from 'react'
import { useIsMobile } from '../hooks/useBreakpoint'
import { useElapsedTimer } from '../hooks/useElapsedTimer'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import { useDownloadStore } from '../stores/downloadStore'
import { getSongMeta, songId } from '../hooks/useDB'
import { getSearchHistory, addSearchHistory, clearSearchHistory, removeSearchHistory } from '../hooks/useSearchHistory'
import { parseMusicUrl, type ParsedMusicUrl } from '../hooks/useUrlParser'
import type { Song } from '../types'
import { Search as SearchIcon, Play, Plus, Download, Music2, Check, Loader, X, Clock, TrendingUp, Link } from 'lucide-react'
import AddToPlaylist from '../components/AddToPlaylist'

const PAGE_SIZE = 20
const SOURCES_STORAGE_KEY = 'selected_search_sources'

interface SourceInfo {
  id: string
  name: string
  enabled: boolean
}

function loadSavedSources(): string[] {
  try { return JSON.parse(localStorage.getItem(SOURCES_STORAGE_KEY) || '[]') } catch { return [] }
}

function saveSources(ids: string[]) {
  localStorage.setItem(SOURCES_STORAGE_KEY, JSON.stringify(ids))
}

export default function Search() {
  const isMobile = useIsMobile()
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Song[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searched, setSearched] = useState(false)
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [addToPlSong, setAddToPlSong] = useState<Song | null>(null)
  const [addToPlPos, setAddToPlPos] = useState<{ top: number; left: number } | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [parsedUrl, setParsedUrl] = useState<ParsedMusicUrl | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [streamStatus, setStreamStatus] = useState('')
  const [availableSources, setAvailableSources] = useState<SourceInfo[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>(loadSavedSources())
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const resultsEndRef = useRef<HTMLDivElement>(null)
  const elapsedSeconds = useElapsedTimer(loading)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const { play } = usePlayerStore()
  const { addTask, tasks } = useDownloadStore()

  useEffect(() => {
    setHistory(getSearchHistory())
    api.get('/sources').then(({ data }) => {
      const sources: SourceInfo[] = (data.sources || []).filter((s: SourceInfo) => s.enabled)
      setAvailableSources(sources)
      const saved = loadSavedSources()
      if (saved.length === 0) {
        setSelectedSources(sources.map(s => s.id))
      } else {
        setSelectedSources(saved.filter(id => sources.some(s => s.id === id)))
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()
    if (!hasMore || loadingMore) return
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )
    if (resultsEndRef.current) {
      observerRef.current.observe(resultsEndRef.current)
    }
    return () => { observerRef.current?.disconnect() }
  }, [hasMore, loadingMore, results])

  const fetchSuggestions = useCallback((q: string) => {
    if (!q.trim()) { setSuggestions([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/search/suggestions', { params: { keyword: q.trim() } })
        setSuggestions(data.suggestions || [])
      } catch {
        setSuggestions([])
      }
    }, 300)
  }, [])

  const handleInputChange = (v: string) => {
    setKeyword(v)
    setParsedUrl(null)
    setShowDropdown(true)
    fetchSuggestions(v)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text')
    const parsed = parseMusicUrl(text)
    if (parsed) {
      e.preventDefault()
      setParsedUrl(parsed)
      setKeyword(text)
      setShowDropdown(false)
    }
  }

  const handleUrlSearch = async () => {
    if (!parsedUrl) return
    setLoading(true)
    addSearchHistory(`[${parsedUrl.platform}] ${parsedUrl.id}`)
    setHistory(getSearchHistory())
    try {
      const { data } = await api.post('/search', {
        keyword: parsedUrl.id,
        sources: [parsedUrl.platform],
        page: 1,
        page_size: PAGE_SIZE,
      })
      setResults(data.results)
      setHasMore(data.has_more)
      setCurrentPage(1)
      setSearched(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    const nextPage = currentPage + 1
    setLoadingMore(true)
    try {
      const { data } = await api.post('/search', {
        keyword,
        page: nextPage,
        page_size: PAGE_SIZE,
      })
      setResults(prev => [...prev, ...data.results])
      setHasMore(data.has_more)
      setCurrentPage(nextPage)
      // Check cache for new songs
      const ids = new Set(cachedIds)
      for (const song of data.results) {
        const id = songId(song.source, song.song_identifier)
        const meta = await getSongMeta(id)
        if (meta) ids.add(id)
      }
      setCachedIds(ids)
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false)
    }
  }

  const handleSearch = async (e?: React.FormEvent, kw?: string) => {
    e?.preventDefault()
    const q = kw || keyword.trim()
    if (!q) return
    setKeyword(q)
    setShowDropdown(false)
    setLoading(true)
    setResults([])
    setCurrentPage(1)
    setStreamStatus('正在连接...')
    addSearchHistory(q)
    setHistory(getSearchHistory())

    // 保存用户源选择
    saveSources(selectedSources)

    const body: Record<string, any> = { keyword: q }
    if (selectedSources.length > 0 && selectedSources.length < availableSources.length) {
      body.sources = selectedSources
    }

    try {
      const baseUrl = api.defaults.baseURL?.replace('/api', '') || window.location.origin
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${baseUrl}/api/search/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const sourceMap = new Map<string, number>()
      const allSongs: Song[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (!line.startsWith('data: ')) continue
            try {
              const parsed = JSON.parse(line.slice(6))

              if (parsed.done) {
                allSongs.sort((a, b) => (b.with_valid_download_url ? 1 : 0) - (a.with_valid_download_url ? 1 : 0))
                setResults([...allSongs])
                setHasMore(false)
                setSearched(true)
                const counts = Object.entries(parsed.source_counts || {}).map(([k, v]) => `${k} ${v}首`).join(', ')
                setStreamStatus(`搜索完成 共${parsed.total}首 (${counts})`)
                setTimeout(() => { setLoading(false); setStreamStatus('') }, 1500)

                const ids = new Set<string>()
                for (const song of allSongs) {
                  const id = songId(song.source, song.song_identifier)
                  const meta = await getSongMeta(id)
                  if (meta) ids.add(id)
                }
                setCachedIds(ids)
              } else if (parsed.songs) {
                allSongs.push(...parsed.songs)
                sourceMap.set(parsed.source_display, parsed.count)
                const total = allSongs.length
                const parts = Array.from(sourceMap.entries()).map(([k, v]) => `${k} ${v}首`).join(', ')
                setStreamStatus(`已找到 ${total} 首 (${parts})`)
                setResults([...allSongs].sort((a, b) => (b.with_valid_download_url ? 1 : 0) - (a.with_valid_download_url ? 1 : 0)))
                setSearched(true)
              }
            } catch {}
          }
        }
      }
    } catch {
      // Fallback to regular search
      try {
        const { data } = await api.post('/search', { keyword: q, page: 1, page_size: PAGE_SIZE })
        setResults(data.results)
        setHasMore(data.has_more)
        setSearched(true)
        const ids = new Set<string>()
        for (const song of data.results) {
          const id = songId(song.source, song.song_identifier)
          const meta = await getSongMeta(id)
          if (meta) ids.add(id)
        }
        setCachedIds(ids)
      } catch {
        setResults([])
      }
      setLoading(false)
      setStreamStatus('')
    }
  }

  const isCached = (song: Song) => cachedIds.has(songId(song.source, song.song_identifier))
  const isDownloading = (song: Song) => tasks.some(
    (t) => t.id === songId(song.source, song.song_identifier) && t.status === 'downloading'
  )
  const isDownloaded = (song: Song) => tasks.some(
    (t) => t.id === songId(song.source, song.song_identifier) && t.status === 'done'
  )

  const formatDuration = (s: number) => {
    if (!s) return '--:--'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleClearHistory = () => {
    clearSearchHistory()
    setHistory([])
  }

  const showHistory = showDropdown && !keyword.trim() && history.length > 0
  const showSuggestions = showDropdown && keyword.trim() && suggestions.length > 0

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120 }}>
      <form onSubmit={(e) => handleSearch(e)} style={{ display: 'flex', gap: isMobile ? 8 : 12, marginBottom: isMobile ? 16 : 32 }}>
        <div style={{ flex: 1, position: 'relative' }} ref={dropdownRef}>
          <SearchIcon size={18} style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)', zIndex: 2,
          }} />
          <input
            ref={inputRef}
            value={keyword}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            onPaste={handlePaste}
            placeholder={isMobile ? '搜索歌曲、歌手...' : '搜索歌曲、歌手、专辑，或粘贴音乐链接...'}
            style={{
              width: '100%', padding: isMobile ? '10px 12px 10px 38px' : '12px 16px 12px 42px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)', fontSize: isMobile ? 14 : 15, outline: 'none',
            }}
          />
          {keyword && (
            <button type="button" onClick={() => { setKeyword(''); setSuggestions([]); inputRef.current?.focus() }}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-tertiary)', padding: 2,
              }}>
              <X size={16} />
            </button>
          )}

          {/* URL parse card */}
          {parsedUrl && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: 'var(--card)', border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-sm)', marginTop: 4,
              boxShadow: 'var(--shadow-lg)', zIndex: 50,
              padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link size={16} style={{ color: 'var(--accent)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>检测到音乐链接</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    平台: {parsedUrl.platform} · ID: {parsedUrl.id}
                  </div>
                </div>
                <button onClick={handleUrlSearch} style={{
                  padding: '6px 14px', background: 'var(--accent)',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>
                  解析搜索
                </button>
              </div>
            </div>
          )}

          {/* History dropdown */}
          {showHistory && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', marginTop: 4,
              boxShadow: 'var(--shadow-lg)', zIndex: 50, maxHeight: 320, overflow: 'auto',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>搜索历史</span>
                <button onClick={handleClearHistory}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12 }}>
                  清空
                </button>
              </div>
              {history.map((h) => (
                <div key={h}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Clock size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)' }}
                    onClick={() => handleSearch(undefined, h)}>{h}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeSearchHistory(h); setHistory(getSearchHistory()) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', marginTop: 4,
              boxShadow: 'var(--shadow-lg)', zIndex: 50, maxHeight: 320, overflow: 'auto',
            }}>
              {suggestions.map((s) => (
                <div key={s}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => handleSearch(undefined, s)}
                >
                  <TrendingUp size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="submit" disabled={loading} style={{
          padding: isMobile ? '10px 16px' : '12px 24px', background: 'var(--accent)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-sm)',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 600, fontSize: isMobile ? 14 : 15, opacity: loading ? 0.7 : 1,
          flexShrink: 0,
        }}>
          {loading ? (isMobile ? '...' : '搜索中...') : '搜索'}
        </button>
      </form>

      {/* Source filter chips */}
      {availableSources.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: isMobile ? 12 : 16 }}>
          <button onClick={() => setSelectedSources(availableSources.map(s => s.id))}
            style={{
              padding: '4px 12px', borderRadius: 14, fontSize: 12, border: '1px solid',
              cursor: 'pointer', transition: 'all 0.15s',
              ...(selectedSources.length === availableSources.length
                ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                : { background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }),
            }}>
            全部
          </button>
          {availableSources.map(src => {
            const active = selectedSources.includes(src.id)
            return (
              <button key={src.id} onClick={() => {
                setSelectedSources(prev => {
                  const next = active ? prev.filter(id => id !== src.id) : [...prev, src.id]
                  saveSources(next)
                  return next.length === 0 ? availableSources.map(s => s.id) : next
                })
              }}
                style={{
                  padding: '4px 12px', borderRadius: 14, fontSize: 12, border: '1px solid',
                  cursor: 'pointer', transition: 'all 0.15s',
                  ...(active
                    ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                    : { background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }),
                }}>
                {src.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Loading animation */}
      {loading && !results.length && (
        <div style={{ textAlign: 'center', padding: '64px 32px' }}>
          <div className="search-loader">
            <div className="search-loader-bar" style={{ animationDelay: '0s' }} />
            <div className="search-loader-bar" style={{ animationDelay: '0.15s' }} />
            <div className="search-loader-bar" style={{ animationDelay: '0.3s' }} />
            <div className="search-loader-bar" style={{ animationDelay: '0.45s' }} />
            <div className="search-loader-bar" style={{ animationDelay: '0.6s' }} />
          </div>
          <div style={{
            marginTop: 24, fontSize: 15, fontWeight: 600,
            color: 'var(--text-secondary)',
          }}>
            正在搜索「{keyword}」
          </div>
          <div style={{
            marginTop: 8, fontSize: 13,
            color: 'var(--text-tertiary)',
          }}>
            {streamStatus || `正在从多个音乐平台检索，请稍候... 已等待 ${elapsedSeconds}s`}
          </div>
          <div className="search-source-dots" style={{
            display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20,
          }}>
            {(availableSources.length > 0 ? availableSources : []).map((src, i) => (
              <span key={src.id} className="search-source-dot" style={{
                animationDelay: `${i * 0.2}s`,
              }}>{src.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Streaming status bar */}
      {loading && results.length > 0 && (
        <div style={{
          padding: '8px 16px', background: 'var(--accent-light)',
          color: 'var(--accent)', fontSize: 13, fontWeight: 500,
          borderRadius: 'var(--radius-sm)', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
          {streamStatus}
        </div>
      )}

      {/* Stream complete status */}
      {!loading && streamStatus && results.length > 0 && (
        <div style={{
          padding: '6px 16px', background: '#f0fdf4',
          color: '#16a34a', fontSize: 12,
          borderRadius: 'var(--radius-sm)', marginBottom: 8,
        }}>
          {streamStatus}
        </div>
      )}

      {/* No results */}
      {searched && results.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          <Music2 size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
          <p>未找到相关歌曲，换个关键词试试</p>
        </div>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <div style={{ borderRadius: isMobile ? 0 : 'var(--radius)', overflow: 'hidden' }}>
          {!isMobile && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 140px 120px 60px 100px',
              padding: '10px 16px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              <span>#</span><span>标题</span><span>歌手</span><span>专辑</span><span>时长</span><span>操作</span>
            </div>
          )}
          {results.map((song, idx) => {
            const cached = isCached(song) || isDownloaded(song)
            const downloading = isDownloading(song)

            // Mobile layout
            if (isMobile) {
              return (
                <div key={`${song.source}-${song.song_identifier}-${idx}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div onClick={() => play(song, results)} style={{
                    width: 44, height: 44, borderRadius: 8,
                    background: 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, overflow: 'hidden', cursor: 'pointer',
                  }}>
                    {song.cover_url ? (
                      <img src={song.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Music2 size={18} style={{ color: 'var(--text-tertiary)' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }} onClick={() => play(song, results)}>
                    <div style={{ fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {song.song_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {song.singers}{song.album ? ` · ${song.album}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                      <span style={{
                        padding: '0px 4px', borderRadius: 3,
                        background: 'var(--accent-light)', color: 'var(--accent)',
                        fontSize: 9,
                      }}>
                        {song.ext.toUpperCase()}
                      </span>
                      <span>{song.source}</span>
                      {cached && <span style={{ color: '#34c759' }}><Check size={10} /></span>}
                      <span>{formatDuration(song.duration_s)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => play(song, results)}
                      title="播放"
                      style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'var(--accent)', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#fff',
                      }}
                    >
                      <Play size={16} fill="currentColor" style={{ marginLeft: 1 }} />
                    </button>
                    <button
                      onClick={() => !cached && !downloading && addTask(song)}
                      title={cached ? '已下载' : downloading ? '下载中...' : '下载'}
                      disabled={cached || downloading}
                      style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'var(--bg-secondary)', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: cached || downloading ? 'default' : 'pointer',
                        color: cached ? '#34c759' : downloading ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                      }}
                    >
                      {downloading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> :
                       cached ? <Check size={14} /> : <Download size={14} />}
                    </button>
                    <div style={{ position: 'relative' }}>
                      <button title="添加到歌单" onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setAddToPlPos({ top: Math.min(rect.bottom + 4, window.innerHeight - 300), left: Math.max(8, rect.left - 160) })
                        setAddToPlSong(addToPlSong?.source === song.source && addToPlSong?.song_identifier === song.song_identifier ? null : song)
                      }} style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'var(--bg-secondary)', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-secondary)',
                      }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            // Desktop layout
            return (
              <div key={`${song.source}-${song.song_identifier}-${idx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 140px 120px 60px 100px',
                  padding: '10px 16px', alignItems: 'center',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--card)', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--card)')}
              >
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{idx + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 6,
                    background: 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, overflow: 'hidden',
                  }}>
                    {song.cover_url ? (
                      <img src={song.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Music2 size={18} style={{ color: 'var(--text-tertiary)' }} />
                    )}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {song.song_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{
                        padding: '1px 5px', borderRadius: 3,
                        background: 'var(--accent-light)', color: 'var(--accent)',
                        fontSize: 10,
                      }}>
                        {song.ext.toUpperCase()}
                      </span>
                      <span>{song.source}</span>
                      {cached && <span style={{ color: '#34c759' }}><Check size={10} /></span>}
                    </div>
                  </div>
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {song.singers}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {song.album || '-'}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                  {formatDuration(song.duration_s)}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => play(song, results)}
                    title="播放"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: song.with_valid_download_url || cached ? 'var(--accent)' : 'var(--text-tertiary)',
                      padding: 4, borderRadius: 4,
                    }}
                  >
                    <Play size={16} />
                  </button>
                  <button
                    onClick={() => !cached && !downloading && addTask(song)}
                    title={cached ? '已下载' : downloading ? '下载中...' : '下载'}
                    disabled={cached || downloading}
                    style={{
                      background: 'none', border: 'none', cursor: cached || downloading ? 'default' : 'pointer',
                      color: cached ? '#34c759' : downloading ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                      padding: 4,
                    }}
                  >
                    {downloading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> :
                     cached ? <Check size={16} /> : <Download size={16} />}
                  </button>
                  <div style={{ position: 'relative' }}>
                    <button title="添加到歌单" onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setAddToPlPos({ top: rect.bottom + 4, left: rect.left - 160 })
                      setAddToPlSong(addToPlSong?.source === song.source && addToPlSong?.song_identifier === song.song_identifier ? null : song)
                    }} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-secondary)', padding: 4,
                    }}>
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Add to playlist popup */}
          {addToPlSong && addToPlPos && (
            <div style={{ position: 'fixed', top: addToPlPos.top, left: addToPlPos.left, zIndex: 100 }}>
              <AddToPlaylist song={addToPlSong} onClose={() => setAddToPlSong(null)} />
            </div>
          )}

          {/* Load more trigger & indicator */}
          <div ref={resultsEndRef} style={{ padding: '16px 0', textAlign: 'center' }}>
            {loadingMore && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-tertiary)' }}>
                <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13 }}>加载更多...</span>
              </div>
            )}
            {!hasMore && results.length > 0 && !loading && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                已显示全部 {results.length} 首歌曲
              </span>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.search-loader {
  display: flex; justify-content: center; align-items: flex-end; gap: 6px; height: 40px;
}
.search-loader-bar {
  width: 6px; border-radius: 3px; background: var(--accent);
  animation: loader-bounce 1s ease-in-out infinite;
}
@keyframes loader-bounce {
  0%, 100% { height: 8px; opacity: 0.4; }
  50% { height: 36px; opacity: 1; }
}

.search-source-dot {
  padding: 4px 12px; border-radius: 12px; font-size: 12px;
  background: var(--bg-secondary); color: var(--text-tertiary);
  animation: dot-pulse 1.2s ease-in-out infinite;
}
@keyframes dot-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.95); }
  50% { opacity: 1; transform: scale(1); background: var(--accent-light); color: var(--accent); }
}`}</style>
    </div>
  )
}
