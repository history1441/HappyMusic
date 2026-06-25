import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import type { Song } from '../types'
import { useHeaderPadding } from '../hooks/useHeaderPadding'
import { useTheme } from '../hooks/useTheme'
import SongContextMenu from '../components/SongContextMenu'

/** 带并发上限的 Promise.all 实现 */
async function promisePool<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = []
  let currentIndex = 0

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++
      try {
        results[idx] = await fn(items[idx], idx)
      } catch (e) {
        results[idx] = undefined as unknown as R
      }
    }
  })

  await Promise.all(workers)
  return results as R[]
}

interface AIRecommendation {
  song: string
  artist: string
  reason: string
  source?: string
  song_identifier?: string
  cover_url?: string
  ext?: string
  duration_s?: number
  download_url?: string
}

export default function AIRecommendScreen() {
  const navigation = useNavigation()
  const playSong = usePlayerStore((s) => s.playSong)
  const headerPad = useHeaderPadding()
  const { colors } = useTheme()

  const [aiEnabled, setAiEnabled] = useState(false)
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [contextSong, setContextSong] = useState<Song | null>(null)
  const [showContext, setShowContext] = useState(false)

  useEffect(() => {
    checkAIStatus()
    loadRecommendations()
  }, [])

  const checkAIStatus = async () => {
    try {
      const { data } = await api.get('/ai/status')
      setAiEnabled(data.enabled !== false)
    } catch {
      // Default to disabled if status check fails
      setAiEnabled(false)
    }
  }

  const loadRecommendations = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const { data } = await api.get('/ai/recommend')
      const recs: AIRecommendation[] = Array.isArray(data) ? data : data.recommendations || []

      // Try to find playable versions for each recommendation (max 3 concurrent)
      const enriched = await promisePool(
        recs,
        async (rec) => {
          try {
            const { data: searchResult } = await api.post('/search', {
              keyword: `${rec.song} ${rec.artist}`,
            })
            const results = Array.isArray(searchResult) ? searchResult : searchResult.results || []
            if (results.length > 0) {
              const first = results[0]
              return {
                ...rec,
                source: first.source,
                song_identifier: first.song_identifier,
                cover_url: first.cover_url,
                ext: first.ext,
                duration_s: first.duration_s,
                download_url: first.download_url,
              }
            }
          } catch {}
          return rec
        },
        3,
      )

      setRecommendations(enriched)
    } catch (e: any) {
      if (!isRefresh) {
        Alert.alert('提示', '获取AI推荐失败')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handlePlay = (rec: AIRecommendation) => {
    if (!rec.source || !rec.song_identifier) {
      Alert.alert('提示', '该歌曲暂无可播放版本')
      return
    }
    const song: Song = {
      song_name: rec.song,
      singers: rec.artist,
      album: '',
      ext: rec.ext || 'mp3',
      file_size: '',
      duration: '',
      duration_s: rec.duration_s || 0,
      source: rec.source,
      song_identifier: rec.song_identifier,
      download_url: rec.download_url || '',
      cover_url: rec.cover_url || '',
      lyric: '',
      with_valid_download_url: !!rec.download_url,
    }
    playSong(song)
  }

  const renderItem = ({ item }: { item: AIRecommendation }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onLongPress={() => {
        if (item.source && item.song_identifier) {
          setContextSong({
            song_name: item.song, singers: item.artist, album: '',
            ext: item.ext || 'mp3', file_size: '', duration: '',
            duration_s: item.duration_s || 0, source: item.source,
            song_identifier: item.song_identifier, download_url: item.download_url || '',
            cover_url: item.cover_url || '', lyric: '', with_valid_download_url: !!item.download_url,
          })
          setShowContext(true)
        }
      }}
    >
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <View style={styles.songInfo}>
          <Text style={[styles.songName, { color: colors.text }]} numberOfLines={1}>{item.song}</Text>
          <Text style={[styles.artistName, { color: colors.textTertiary }]} numberOfLines={1}>{item.artist}</Text>
        </View>
        {item.source && item.song_identifier ? (
          <TouchableOpacity
            style={[styles.playButton, { backgroundColor: colors.primary }]}
            onPress={() => handlePlay(item)}
          >
            <Ionicons name="play" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.noPlayButton, { backgroundColor: colors.borderLight }]}>
            <Ionicons name="musical-note-outline" size={16} color={colors.textTertiary} />
          </View>
        )}
      </View>
      <View style={[styles.reasonContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="sparkles" size={14} color={colors.primary} />
        <Text style={[styles.reasonText, { color: colors.textSecondary }]} numberOfLines={2}>{item.reason}</Text>
      </View>
    </View>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: headerPad, backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>AI 推荐</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textTertiary }]}>AI 正在分析你的喜好...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: headerPad, backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>AI 推荐</Text>
        <TouchableOpacity onPress={() => loadRecommendations(true)}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {!aiEnabled && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={16} color="#f59e0b" />
          <Text style={styles.warningText}>AI 推荐服务未启用，部分功能不可用</Text>
        </View>
      )}

      <FlatList
        data={recommendations}
        keyExtractor={(item, idx) => `${item.song}_${item.artist}_${idx}`}
        renderItem={renderItem}
        removeClippedSubviews={true}
        initialNumToRender={8}
        maxToRenderPerBatch={5}
        windowSize={5}
        refreshing={refreshing}
        onRefresh={() => loadRecommendations(true)}
        contentContainerStyle={recommendations.length === 0 ? styles.emptyList : { paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="sparkles-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无AI推荐</Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => loadRecommendations()}>
              <Text style={styles.retryText}>重新获取</Text>
            </TouchableOpacity>
          </View>
        }
      />
      <SongContextMenu song={contextSong} visible={showContext} onClose={() => setShowContext(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fefce8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#fef3c7',
  },
  warningText: {
    fontSize: 13,
    color: '#b45309',
    flex: 1,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  songInfo: {
    flex: 1,
    marginRight: 12,
  },
  songName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  artistName: {
    fontSize: 13,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 8,
    padding: 10,
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
})
