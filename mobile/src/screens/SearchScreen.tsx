import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { searchLocal } from '../services/cacheService'
import { getSearchHistory, addSearchHistory, clearSearchHistory } from '../services/searchHistoryService'
import { usePlayerStore } from '../stores/playerStore'
import { getCachedAccessToken } from '../services/api'
import { getApiUrl } from '../utils/constants'
import api from '../services/api'
import SongItem from '../components/SongItem'
import SongContextMenu from '../components/SongContextMenu'
import { showToast } from '../components/Toast'
import { useTheme } from '../hooks/useTheme'
import { getSelectedSources } from '../services/sourceService'
import { useQualityStore } from '@happymusic/common'
import type { Song } from '../types'

export default function SearchScreen() {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<(Song & { localStatus?: string })[]>([])
  const [searching, setSearching] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(true)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [favSet, setFavSet] = useState<Set<string>>(new Set())
  const [favPlaylistId, setFavPlaylistId] = useState<number | null>(null)
  const [streamStatus, setStreamStatus] = useState('')
  const [userSources, setUserSources] = useState<string[]>([])
  const { playSong, addToNext } = usePlayerStore(s => ({ playSong: s.playSong, addToNext: s.addToNext }))
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [contextSong, setContextSong] = useState<Song | null>(null)
  const [showContext, setShowContext] = useState(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    loadHistory()
    loadFavorites()
    getSelectedSources().then(setUserSources)
    return () => {
      // 组件卸载时取消进行中的搜索请求和输入防抖定时器
      abortRef.current?.abort()
      if (suggestTimer.current) clearTimeout(suggestTimer.current)
    }
  }, [])

  const loadHistory = async () => {
    const h = await getSearchHistory()
    setHistory(h)
  }

  const loadFavorites = async () => {
    try {
      const { data } = await api.get('/playlists')
      const playlists = data.playlists || data || []
      const fav = playlists.find((p: any) => p.is_favorite)
      if (fav) {
        setFavPlaylistId(fav.id)
        const keys = new Set<string>((fav.songs || []).map((s: any) => `${s.source}_${s.song_identifier}`))
        setFavSet(keys)
      }
    } catch {}
  }

  const toggleFavorite = async (song: Song) => {
    if (!favPlaylistId) return
    const key = `${song.source}_${song.song_identifier}`
    const wasFav = favSet.has(key)

    // Optimistic update
    setFavSet(prev => {
      const next = new Set(prev)
      if (wasFav) next.delete(key)
      else next.add(key)
      return next
    })

    try {
      if (wasFav) {
        const { data } = await api.get(`/playlists/${favPlaylistId}`)
        const found = (data.songs || []).find((s: any) => s.source === song.source && s.song_identifier === song.song_identifier)
        if (found) {
          await api.delete(`/playlists/${favPlaylistId}/songs/${found.id}`)
        }
      } else {
        await api.post(`/playlists/${favPlaylistId}/songs`, {
          song_name: song.song_name, singers: song.singers,
          album: song.album || '', ext: song.ext || 'mp3',
          duration: song.duration_s || 0, source: song.source,
          song_identifier: song.song_identifier,
          lyric: song.lyric || '', cover_url: song.cover_url || '',
        })
      }
    } catch {
      // Rollback on failure
      setFavSet(prev => {
        const next = new Set(prev)
        if (wasFav) next.add(key)
        else next.delete(key)
        return next
      })
    }
  }

  const parseSSELines = (buffer: string): { events: string[], remaining: string } => {
    const events: string[] = []
    const parts = buffer.split('\n\n')
    const remaining = parts.pop() || ''
    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (line.startsWith('data: ')) events.push(line.slice(6))
      }
    }
    return { events, remaining }
  }

  const mergeResults = (onlineSongs: any[], localResults: any[]) => {
    const localMap = new Map(localResults.map(s => [`${s.source}_${s.song_identifier}`, s]))
    const merged = onlineSongs.map((song: any) => {
      const local = localMap.get(`${song.source}_${song.song_identifier}`)
      return { ...song, localStatus: local?.localStatus || null } as Song & { localStatus?: string }
    })
    const onlineKeys = new Set(onlineSongs.map((s: any) => `${s.source}_${s.song_identifier}`))
    for (const local of localResults) {
      if (!onlineKeys.has(`${local.source}_${local.song_identifier}`)) {
        merged.push({
          ...local, localStatus: local.localStatus, download_url: '', lyric: '',
          duration: String(local.duration), file_size: String(local.file_size), with_valid_download_url: false,
        } as any)
      }
    }
    return merged
  }

  const processSSEEvents = (events: string[], allOnlineSongs: any[], localResults: any[], sourceMap: Map<string, number>) => {
    let isDone = false
    for (const eventData of events) {
      try {
        const parsed = JSON.parse(eventData)
        if (parsed.done) {
          allOnlineSongs.sort((a, b) => (b.with_valid_download_url ? 1 : 0) - (a.with_valid_download_url ? 1 : 0))
          const merged = mergeResults(allOnlineSongs, localResults)
          setResults(merged)
          const counts = Object.entries(parsed.source_counts || {}).map(([k, v]) => `${k} ${v}首`).join(', ')
          setStreamStatus(`搜索完成 共${parsed.total}首 (${counts})`)
          setTimeout(() => setSearching(false), 1500)
          isDone = true
        } else if (parsed.songs) {
          allOnlineSongs.push(...parsed.songs)
          sourceMap.set(parsed.source_display, parsed.count)
          const totalSoFar = allOnlineSongs.length
          const parts = Array.from(sourceMap.entries()).map(([k, v]) => `${k} ${v}首`).join(', ')
          setStreamStatus(`已找到 ${totalSoFar} 首 (${parts})`)
          const merged = mergeResults(allOnlineSongs, localResults)
          setResults(merged)
        }
      } catch {}
    }
    return isDone
  }

  const handleSearch = useCallback(async (kw?: string) => {
    const q = (kw || keyword).trim()
    if (!q) return
    setKeyword(q)
    setShowHistory(false)
    setSuggestions([])
    setSearching(true)
    setResults([])
    setStreamStatus('正在搜索...')
    await addSearchHistory(q)
    loadHistory()

    const localResults = await searchLocal(q).catch(() => []) as any[]

    if (abortRef.current) abortRef.current.abort()
    const abortController = new AbortController()
    abortRef.current = abortController

    const apiBaseUrl = getApiUrl()
    const token = getCachedAccessToken()
    // 每次搜索前重新读取最新的用户源偏好
    const sources = await getSelectedSources()
    setUserSources(sources)
    const body: any = { keyword: q, quality: useQualityStore.getState().quality }
    if (sources.length > 0) body.sources = sources

    try {
      const response = await fetch(`${apiBaseUrl}/api/search/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: abortController.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const sourceMap = new Map<string, number>()
      const allOnlineSongs: any[] = []

      if (response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const { events, remaining } = parseSSELines(buffer)
          buffer = remaining
          if (processSSEEvents(events, allOnlineSongs, localResults, sourceMap)) break
        }
      } else {
        try {
          const text = await response.text()
          const { events } = parseSSELines(text + '\n\n')
          processSSEEvents(events, allOnlineSongs, localResults, sourceMap)
        } catch {
          const onlineRes = await api.post('/search', body, { timeout: 60000 }).catch(() => ({ data: { results: [] } }))
          const onlineSongs: Song[] = onlineRes.data.results || []
          const merged = mergeResults(onlineSongs, localResults)
          setResults(merged)
          setStreamStatus(`搜索完成 共${onlineSongs.length}首`)
          setTimeout(() => setSearching(false), 1000)
          return
        }
      }

      if (allOnlineSongs.length > 0 && searching) {
        allOnlineSongs.sort((a, b) => (b.with_valid_download_url ? 1 : 0) - (a.with_valid_download_url ? 1 : 0))
        const merged = mergeResults(allOnlineSongs, localResults)
        setResults(merged)
        if (streamStatus.includes('已找到') || streamStatus.includes('正在')) {
          const parts = Array.from(sourceMap.entries()).map(([k, v]) => `${k} ${v}首`).join(', ')
          setStreamStatus(`搜索完成 共${allOnlineSongs.length}首 (${parts})`)
          setTimeout(() => setSearching(false), 1500)
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return
      console.warn('Stream search error:', e?.message || e)
      try {
        const onlineRes = await api.post('/search', body, { timeout: 60000 }).catch(() => ({ data: { results: [] } }))
        const onlineSongs: Song[] = onlineRes.data.results || []
        const merged = mergeResults(onlineSongs, localResults)
        setResults(merged)
        setStreamStatus(`搜索完成 共${onlineSongs.length}首`)
      } catch {
        setResults([])
      }
      setSearching(false)
    }
  }, [keyword])

  const handleInputChange = async (text: string) => {
    setKeyword(text)
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (text.trim().length >= 2) {
      setShowHistory(false)
      suggestTimer.current = setTimeout(async () => {
        try {
          const { data } = await api.get('/search/suggestions', { params: { keyword: text.trim() } })
          setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : Array.isArray(data) ? data : [])
        } catch {
          setSuggestions([])
        }
      }, 500)
    } else {
      setShowHistory(true)
      setSuggestions([])
      if (!text.trim()) setResults([])
    }
  }

  const renderItem = ({ item }: { item: Song & { localStatus?: string } }) => {
    const isFav = favSet.has(`${item.source}_${item.song_identifier}`)
    return (
      <SongItem
        song={item}
        localStatus={item.localStatus}
        showDownload
        isFavorite={isFav}
        onToggleFavorite={async () => {
          const wasFav = isFav
          await toggleFavorite(item)
          showToast(wasFav ? `已取消收藏 ${item.song_name}` : `已收藏 ${item.song_name}`)
        }}
        onPlayNext={() => {
          addToNext(item)
          showToast(`已添加 ${item.song_name} 到播放列表`)
        }}
        onPress={() => {
          playSong(item).catch(() => {})
          showToast(`正在播放 ${item.song_name}`)
        }}
        onLongPress={() => { setContextSong(item); setShowContext(true) }}
      />
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchHeader, { paddingTop: insets.top + 16, backgroundColor: colors.background }]}>
        <View style={styles.searchBarWrap}>
          <View style={[styles.searchInputWrap, { backgroundColor: colors.card }]}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="搜索歌手、歌曲"
              placeholderTextColor={colors.textTertiary}
              value={keyword}
              onChangeText={handleInputChange}
              onSubmitEditing={() => handleSearch()}
              returnKeyType="search"
              onFocus={() => { if (!keyword.trim()) setShowHistory(true) }}
            />
            {keyword ? (
              <TouchableOpacity onPress={() => { setKeyword(''); setSuggestions([]); setShowHistory(true); setResults([]); setStreamStatus('') }}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={[styles.searchBtn, { backgroundColor: colors.primary }]} onPress={() => handleSearch()}>
            <Text style={styles.searchBtnText}>搜索</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 流式搜索状态 */}
      {searching && (
        <View style={[styles.streamBar, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.streamText, { color: colors.primary }]}>{streamStatus || '搜索中...'}</Text>
        </View>
      )}
      {!searching && streamStatus && results.length > 0 && (
        <View style={styles.streamBarDone}>
          <Text style={styles.streamDoneText}>{streamStatus}</Text>
        </View>
      )}

      {/* 搜索结果 - FlatList 支持滚动翻页 */}
      {results.length > 0 ? (
        <FlatList
          style={[styles.resultsList, { backgroundColor: colors.card }]}
          data={results}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={3}
          removeClippedSubviews={true}
          ListFooterComponent={searching ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingMoreText, { color: colors.textTertiary }]}>加载更多...</Text>
            </View>
          ) : results.length > 0 ? (
            <View style={styles.listEnd}>
              <Text style={[styles.listEndText, { color: colors.textTertiary }]}>已加载全部 {results.length} 首</Text>
            </View>
          ) : null}
        />
      ) : (
        <>
          {/* 搜索历史 */}
          {!searching && showHistory && history.length > 0 && suggestions.length === 0 && (
            <View style={styles.historySection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.historyTitle, { color: colors.text }]}>搜索历史</Text>
                <TouchableOpacity onPress={async () => { await clearSearchHistory(); loadHistory() }}>
                  <Ionicons name="trash-outline" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <View style={styles.historyTags}>
                {history.map((item, index) => (
                  <TouchableOpacity key={index} style={[styles.tag, { backgroundColor: colors.card }]} onPress={() => handleSearch(item)}>
                    <Text style={[styles.tagText, { color: colors.textSecondary }]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 搜索建议 */}
          {!searching && !showHistory && suggestions.length > 0 && (
            <View style={[styles.suggestionsSection, { backgroundColor: colors.card }]}>
              {suggestions.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.suggestionRow, { borderBottomColor: colors.borderLight }, index === suggestions.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => handleSearch(item)}
                >
                  <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
                  <Text style={[styles.suggestionText, { color: colors.text }]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 无结果 */}
          {!searching && !showHistory && suggestions.length === 0 && keyword.trim() && (
            <View style={styles.noResultContainer}>
              <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.noResultText, { color: colors.textSecondary }]}>未找到 "{keyword}" 的相关结果</Text>
              <Text style={[styles.noResultHint, { color: colors.textTertiary }]}>请尝试其他关键词</Text>
            </View>
          )}

          {/* 空状态 */}
          {!searching && suggestions.length === 0 && showHistory && history.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyStateText, { color: colors.textTertiary }]}>输入关键词搜索音乐</Text>
            </View>
          )}
        </>
      )}
      <SongContextMenu song={contextSong} visible={showContext} onClose={() => setShowContext(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchHeader: { paddingHorizontal: 16, paddingBottom: 12 },
  searchBarWrap: { flexDirection: 'row', alignItems: 'center' },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingHorizontal: 14, height: 40, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2,
  },
  input: { flex: 1, marginLeft: 8, fontSize: 14, paddingVertical: 0 },
  searchBtn: {
    marginLeft: 12, height: 40, paddingHorizontal: 16,
    borderRadius: 20, justifyContent: 'center', alignItems: 'center',
  },
  searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },

  streamBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1,
  },
  streamText: { fontSize: 13, fontWeight: '500' },
  streamBarDone: {
    paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#f0fdf4',
    borderBottomWidth: 1, borderBottomColor: '#dcfce7',
  },
  streamDoneText: { fontSize: 12, color: '#16a34a' },

  resultsList: { flex: 1, marginTop: 4 },
  loadingMore: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 8 },
  loadingMoreText: { fontSize: 13 },
  listEnd: { alignItems: 'center', paddingVertical: 16 },
  listEndText: { fontSize: 12 },

  historySection: { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  historyTitle: { fontSize: 15, fontWeight: 'bold' },
  historyTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  tagText: { fontSize: 13 },

  suggestionsSection: { marginTop: 8, borderRadius: 8, marginHorizontal: 16, overflow: 'hidden' },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  suggestionText: { fontSize: 14, marginLeft: 8 },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyStateText: { marginTop: 12, fontSize: 14 },
  noResultContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  noResultText: { fontSize: 15, marginTop: 12 },
  noResultHint: { fontSize: 13, marginTop: 4 },
})
