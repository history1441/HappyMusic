import React, { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import { showToast } from '../components/Toast'
import type { Song } from '../types'
import { useHeaderPadding } from '../hooks/useHeaderPadding'
import { useTheme } from '../hooks/useTheme'
import SongContextMenu from '../components/SongContextMenu'

type PeriodType = 'day' | 'week' | 'month' | 'all'

interface HotSong {
  rank: number
  song_name: string
  singers: string
  play_count: number
  source?: string
  song_identifier?: string
  cover_url?: string
  ext?: string
  duration_s?: number
}

function formatPlayCount(count: number): string {
  if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
  return count.toString()
}

export default function HotChartsScreen() {
  const navigation = useNavigation()
  const playSong = usePlayerStore((s) => s.playSong)
  const headerPad = useHeaderPadding()
  const { colors } = useTheme()

  const [period, setPeriod] = useState<PeriodType>('day')
  const [songs, setSongs] = useState<HotSong[]>([])
  const [loading, setLoading] = useState(false)
  const [contextSong, setContextSong] = useState<Song | null>(null)
  const [showContext, setShowContext] = useState(false)

  useEffect(() => {
    loadCharts()
  }, [period])

  const loadCharts = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/global-hot', { params: { period } })
      setSongs(Array.isArray(data) ? data.map((item: any, idx: number) => ({ ...item, rank: idx + 1, play_count: item.play_count || item.plays || 0 })) : [])
    } catch (e) {
      console.error('Failed to load charts:', e)
      setSongs([])
    } finally {
      setLoading(false)
    }
  }

  const handlePlayAll = () => {
    if (songs.length === 0) return
    const playables: Song[] = songs
      .filter((s) => s.source && s.song_identifier)
      .map((s) => ({
        song_name: s.song_name,
        singers: s.singers,
        album: '',
        ext: s.ext || 'mp3',
        file_size: '',
        duration: '',
        duration_s: s.duration_s || 0,
        source: s.source!,
        song_identifier: s.song_identifier!,
        download_url: '',
        cover_url: s.cover_url || '',
        lyric: '',
        with_valid_download_url: false,
      }))
    if (playables.length > 0) {
      playSong(playables[0], playables)
    }
  }

  const periods: { key: PeriodType; label: string }[] = [
    { key: 'day', label: '日' },
    { key: 'week', label: '周' },
    { key: 'month', label: '月' },
    { key: 'all', label: '全部' },
  ]

  const renderRankNumber = (rank: number) => {
    if (rank <= 3) {
      return (
        <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.rankTopText}>{rank}</Text>
        </View>
      )
    }
    return (
      <View style={[styles.rankBadge, { backgroundColor: colors.borderLight }]}>
        <Text style={[styles.rankNormalText, { color: colors.textTertiary }]}>{rank}</Text>
      </View>
    )
  }

  const renderItem = ({ item }: { item: HotSong }) => (
    <TouchableOpacity
      style={[styles.songRow, { backgroundColor: colors.card, borderBottomColor: colors.background }]}
      activeOpacity={0.7}
      onPress={() => {
        if (item.source && item.song_identifier) {
          showToast(`正在加载: ${item.song_name}`)
          playSong({
            song_name: item.song_name,
            singers: item.singers,
            album: '',
            ext: item.ext || 'mp3',
            file_size: '',
            duration: '',
            duration_s: item.duration_s || 0,
            source: item.source,
            song_identifier: item.song_identifier,
            download_url: '',
            cover_url: item.cover_url || '',
            lyric: '',
            with_valid_download_url: false,
          })
        }
      }}
      onLongPress={() => {
        if (item.source && item.song_identifier) {
          setContextSong({
            song_name: item.song_name, singers: item.singers, album: '',
            ext: item.ext || 'mp3', file_size: '', duration: '',
            duration_s: item.duration_s || 0, source: item.source!,
            song_identifier: item.song_identifier!, download_url: '',
            cover_url: item.cover_url || '', lyric: '', with_valid_download_url: false,
          })
          setShowContext(true)
        }
      }}
    >
      {renderRankNumber(item.rank)}
      <View style={styles.songInfo}>
        <Text style={[styles.songName, { color: item.rank <= 3 ? colors.primary : colors.text }, item.rank <= 3 && styles.songNameTop]} numberOfLines={1}>
          {item.song_name}
        </Text>
        <Text style={[styles.singerText, { color: colors.textTertiary }]} numberOfLines={1}>{item.singers}</Text>
      </View>
      <Text style={[styles.playCount, { color: colors.textTertiary }]}>{formatPlayCount(item.play_count)}</Text>
    </TouchableOpacity>
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: headerPad, backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>热歌榜</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.periodContainer, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        {periods.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodButton, period === p.key ? { backgroundColor: colors.borderLight } : { backgroundColor: colors.borderLight }]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.periodText, period === p.key ? [styles.periodTextActive, { color: colors.primary }] : { color: colors.textSecondary }]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {songs.length > 0 && (
        <TouchableOpacity style={[styles.playAllBar, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]} onPress={handlePlayAll}>
          <Ionicons name="play-circle" size={18} color={colors.primary} />
          <Text style={[styles.playAllText, { color: colors.primary }]}>播放全部</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item, idx) => `${item.rank}_${idx}`}
          renderItem={renderItem}
          removeClippedSubviews={true}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={5}
          contentContainerStyle={songs.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="flame-outline" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无热歌数据</Text>
            </View>
          }
        />
      )}
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
  periodContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  periodText: {
    fontSize: 13,
  },
  periodTextActive: {
    fontWeight: '600',
  },
  playAllBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  playAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankTopText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  rankNormalText: {
    fontSize: 13,
    fontWeight: '600',
  },
  songInfo: {
    flex: 1,
    marginRight: 12,
  },
  songName: {
    fontSize: 15,
    fontWeight: '400',
    marginBottom: 2,
  },
  songNameTop: {
    fontWeight: '600',
  },
  singerText: {
    fontSize: 13,
  },
  playCount: {
    fontSize: 12,
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
  },
})
