import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import { useHeaderPadding } from '../hooks/useHeaderPadding'
import { useTheme } from '../hooks/useTheme'
import MoodLoadingAnimation from '../components/MoodLoadingAnimation'
import SongContextMenu from '../components/SongContextMenu'
import type { Song } from '../types'

type MoodType = 'happy' | 'sad' | 'relax' | 'sport' | 'focus' | 'romantic'

interface MoodConfig {
  key: MoodType
  emoji: string
  label: string
  description: string
  color: string
}

interface MoodSong {
  song_name: string
  singers: string
  source?: string
  song_identifier?: string
  cover_url?: string
  ext?: string
  duration_s?: number
}

const MOODS: MoodConfig[] = [
  { key: 'happy', emoji: '\u{1F60A}', label: '开心', description: '欢快的旋律', color: '#fbbf24' },
  { key: 'sad', emoji: '\u{1F622}', label: '伤感', description: '安静治愈的歌声', color: '#60a5fa' },
  { key: 'relax', emoji: '\u{1F60C}', label: '放松', description: '舒缓身心的音乐', color: '#34d399' },
  { key: 'sport', emoji: '\u{1F3C3}', label: '运动', description: '充满能量的节拍', color: '#f97316' },
  { key: 'focus', emoji: '\u{1F3AF}', label: '专注', description: '提升注意力的音乐', color: '#8b5cf6' },
  { key: 'romantic', emoji: '\u{1F495}', label: '浪漫', description: '甜蜜温馨的旋律', color: '#f472b6' },
]

export default function MoodRadioScreen() {
  const navigation = useNavigation()
  const playSong = usePlayerStore((s) => s.playSong)
  const headerPad = useHeaderPadding()
  const { colors } = useTheme()

  const [activeMood, setActiveMood] = useState<MoodType | null>(null)
  const [moodColor, setMoodColor] = useState('#EC4141')
  const [songs, setSongs] = useState<MoodSong[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState<1 | 2 | 3>(1)
  const [aiAvailable, setAiAvailable] = useState(false)
  const [halfFetched, setHalfFetched] = useState(false)
  const [fetchingMore, setFetchingMore] = useState(false)
  const [contextSong, setContextSong] = useState<Song | null>(null)
  const [showContext, setShowContext] = useState(false)
  const queueIndexRef = useRef(-1)

  useEffect(() => {
    checkAiStatus()
  }, [])

  // 半程补充逻辑
  useEffect(() => {
    if (!activeMood || halfFetched || fetchingMore || songs.length === 0) return
    const unsub = usePlayerStore.subscribe((state) => {
      if (halfFetched || fetchingMore) return
      const halfIndex = Math.floor(songs.length / 2)
      if (state.queueIndex >= halfIndex && state.queueIndex !== queueIndexRef.current) {
        queueIndexRef.current = state.queueIndex
        fetchMoreSongs()
      }
    })
    return () => unsub()
  }, [activeMood, halfFetched, fetchingMore, songs.length])

  const checkAiStatus = async () => {
    try {
      const { data } = await api.get('/ai/status')
      setAiAvailable(data.enabled === true)
    } catch {
      setAiAvailable(false)
    }
  }

  const loadMoodSongs = async (mood: MoodType) => {
    const moodConfig = MOODS.find((m) => m.key === mood)!
    setActiveMood(mood)
    setMoodColor(moodConfig.color)
    setSongs([])
    setHalfFetched(false)
    setFetchingMore(false)

    if (aiAvailable) {
      await loadWithAi(mood)
    } else {
      await loadFallback(mood)
    }
  }

  const loadWithAi = async (mood: MoodType) => {
    setLoading(true)
    try {
      // Phase 1: AI 生成歌单
      setLoadingPhase(1)
      const { data: playlistData } = await api.post('/ai/mood-playlist', { mood }, { timeout: 30000 })
      const suggestions: { song_name: string; singers: string }[] = playlistData.songs || []
      if (suggestions.length === 0) {
        setLoading(false)
        return
      }

      // Phase 2: 搜索匹配
      setLoadingPhase(2)
      const matched = await searchAndMatch(suggestions)
      if (matched.length > 0) {
        // Phase 3: 准备播放
        setLoadingPhase(3)
        setSongs(matched)
      }
    } catch (e) {
      console.warn('AI mood radio failed:', e)
    }
    setLoading(false)
  }

  const loadFallback = async (mood: MoodType) => {
    setLoading(true)
    try {
      const { data } = await api.get('/mood-radio', { params: { mood } })
      setSongs(Array.isArray(data) ? data : [])
    } catch {
      setSongs([])
    }
    setLoading(false)
  }

  const searchAndMatch = async (suggestions: { song_name: string; singers: string }[]): Promise<MoodSong[]> => {
    const results = await Promise.all(
      suggestions.map(async ({ song_name, singers }) => {
        try {
          const { data } = await api.post('/search', {
            keyword: `${song_name} ${singers}`,
          }, { timeout: 15000 })
          const songs: any[] = data.results || data.songs || []
          if (songs.length === 0) return null
          // 优先精确匹配：歌名+歌手都匹配
          const exact = songs.find((s: any) => {
            const nameOk = s.song_name?.toLowerCase().includes(song_name.toLowerCase())
            const singerOk = s.singers?.toLowerCase().includes(singers.split(',')[0].trim().toLowerCase())
            return nameOk && singerOk
          })
          // 降级：歌名匹配
          const fallback = songs.find((s: any) =>
            s.song_name?.toLowerCase().includes(song_name.toLowerCase())
          )
          const match = exact || fallback || songs[0]
          return match ? {
            song_name: match.song_name,
            singers: match.singers,
            source: match.source,
            song_identifier: match.song_identifier,
            cover_url: match.cover_url || '',
            ext: match.ext || 'mp3',
            duration_s: match.duration_s || 0,
          } as MoodSong : null
        } catch {
          return null
        }
      })
    )
    return results.filter((r): r is MoodSong => r !== null && !!r.source && !!r.song_identifier)
  }

  const fetchMoreSongs = async () => {
    if (!activeMood || fetchingMore || halfFetched) return
    setFetchingMore(true)
    try {
      const existingNames = songs.map((s) => s.song_name)
      const { data } = await api.post('/ai/mood-playlist', { mood: activeMood, current_list: existingNames }, { timeout: 30000 })
      const newSuggestions: { song_name: string; singers: string }[] = data.songs || []
      if (newSuggestions.length > 0) {
        const matched = await searchAndMatch(newSuggestions)
        if (matched.length > 0) {
          setSongs((prev) => [...prev, ...matched])
        }
      }
    } catch {}
    setHalfFetched(true)
    setFetchingMore(false)
  }

  const handlePlayAll = () => {
    if (songs.length === 0) return
    const playables: Song[] = songs
      .filter((s) => s.source && s.song_identifier)
      .map((s) => ({
        song_name: s.song_name, singers: s.singers, album: '',
        ext: s.ext || 'mp3', file_size: '', duration: '',
        duration_s: s.duration_s || 0, source: s.source!,
        song_identifier: s.song_identifier!, download_url: '',
        cover_url: s.cover_url || '', lyric: '', with_valid_download_url: false,
      }))
    if (playables.length > 0) playSong(playables[0], playables)
  }

  const handleRefresh = () => {
    if (activeMood) loadMoodSongs(activeMood)
  }

  const renderMoodCard = (mood: MoodConfig) => {
    const isActive = activeMood === mood.key
    return (
      <TouchableOpacity
        key={mood.key}
        style={[styles.moodCard, { backgroundColor: mood.color + '20' }, isActive && { borderColor: mood.color, borderWidth: 2 }]}
        onPress={() => loadMoodSongs(mood.key)}
        activeOpacity={0.8}
      >
        <Text style={styles.moodEmoji}>{mood.emoji}</Text>
        <Text style={[styles.moodLabel, { color: mood.color }]}>{mood.label}</Text>
        <Text style={[styles.moodDesc, { color: colors.textTertiary }]}>{mood.description}</Text>
      </TouchableOpacity>
    )
  }

  const renderItem = ({ item }: { item: MoodSong }) => (
    <TouchableOpacity
      style={[styles.songRow, { backgroundColor: colors.card, borderBottomColor: colors.background }]}
      activeOpacity={0.7}
      onPress={() => {
        if (item.source && item.song_identifier) {
          playSong({
            song_name: item.song_name, singers: item.singers, album: '',
            ext: item.ext || 'mp3', file_size: '', duration: '',
            duration_s: item.duration_s || 0, source: item.source,
            song_identifier: item.song_identifier, download_url: '',
            cover_url: item.cover_url || '', lyric: '', with_valid_download_url: false,
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
      <View style={styles.songInfo}>
        <Text style={[styles.songName, { color: colors.text }]} numberOfLines={1}>{item.song_name}</Text>
        <Text style={[styles.singerText, { color: colors.textTertiary }]} numberOfLines={1}>{item.singers}</Text>
      </View>
      <Ionicons name="play-outline" size={20} color={colors.primary} />
    </TouchableOpacity>
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: headerPad, backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>心情电台{aiAvailable ? '' : ' · 基础模式'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.moodGrid, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        {MOODS.map((mood) => renderMoodCard(mood))}
      </View>

      {activeMood && (
        <>
          <View style={[styles.resultHeader, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.resultTitle, { color: colors.text }]}>
              {MOODS.find((m) => m.key === activeMood)?.emoji}{' '}
              {MOODS.find((m) => m.key === activeMood)?.label}电台
            </Text>
            <View style={styles.resultActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={handlePlayAll}>
                <Ionicons name="play-circle" size={18} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.primary }]}>播放全部</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleRefresh}>
                <Ionicons name="refresh" size={16} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.primary }]}>换一批</Text>
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <MoodLoadingAnimation phase={loadingPhase} moodColor={moodColor} />
          ) : (
            <FlatList
              data={songs}
              keyExtractor={(item, idx) => `${item.song_name}_${idx}`}
              renderItem={renderItem}
              contentContainerStyle={songs.length === 0 ? styles.emptyList : undefined}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无推荐歌曲</Text>
                </View>
              }
            />
          )}
        </>
      )}

      {!activeMood && (
        <View style={styles.hintContainer}>
          <Ionicons name="radio-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.hintText, { color: colors.textTertiary }]}>选择一种心情开始收听</Text>
        </View>
      )}
      <SongContextMenu song={contextSong} visible={showContext} onClose={() => setShowContext(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  moodGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
    gap: 12, borderBottomWidth: 1,
  },
  moodCard: {
    width: '30.5%', aspectRatio: 1.2, borderRadius: 16, padding: 12,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  moodEmoji: { fontSize: 32, marginBottom: 4 },
  moodLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  moodDesc: { fontSize: 11, textAlign: 'center' },
  resultHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  resultTitle: { fontSize: 16, fontWeight: '600' },
  resultActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, fontWeight: '500' },
  songRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  songInfo: { flex: 1, marginRight: 12 },
  songName: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  singerText: { fontSize: 13 },
  emptyList: { flexGrow: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15 },
  hintContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hintText: { fontSize: 15, marginTop: 12 },
})
