import React, { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { getDB } from '../database/schema'
import { usePlayerStore } from '../stores/playerStore'
import type { Song } from '../types'
import { useHeaderPadding } from '../hooks/useHeaderPadding'
import { useTheme } from '../hooks/useTheme'
import SongItem from '../components/SongItem'
import SongContextMenu from '../components/SongContextMenu'

interface RecentPlay {
  id: number
  song_name: string
  singers: string
  album: string
  ext: string
  duration_s: number
  source: string
  song_identifier: string
  cover_url: string
  lyric: string
  played_at: number
}

function toSong(rp: RecentPlay): Song {
  return {
    song_name: rp.song_name,
    singers: rp.singers,
    album: rp.album,
    ext: rp.ext,
    file_size: '',
    duration: '',
    duration_s: rp.duration_s,
    source: rp.source,
    song_identifier: rp.song_identifier,
    download_url: '',
    cover_url: rp.cover_url,
    lyric: rp.lyric,
    with_valid_download_url: false,
  }
}

export default function RecentPlaysScreen() {
  const navigation = useNavigation()
  const playSong = usePlayerStore((s) => s.playSong)
  const [plays, setPlays] = useState<RecentPlay[]>([])
  const [loading, setLoading] = useState(true)
  const [contextSong, setContextSong] = useState<Song | null>(null)
  const [showContext, setShowContext] = useState(false)
  const headerPad = useHeaderPadding()
  const { colors } = useTheme()

  const loadPlays = async () => {
    try {
      const db = await getDB()
      const rows = await db.getAllAsync<RecentPlay>(
        'SELECT * FROM recent_plays ORDER BY played_at DESC'
      )
      setPlays(rows)
    } catch (e) {
      console.error('Failed to load recent plays:', e)
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadPlays()
    }, [])
  )

  const handlePlayAll = () => {
    if (plays.length === 0) return
    const songs = plays.map(toSong)
    playSong(songs[0], songs)
  }

  const handleClearHistory = () => {
    Alert.alert('确认清除', '确定要清除所有播放历史吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: async () => {
          try {
            const db = await getDB()
            await db.runAsync('DELETE FROM recent_plays')
            setPlays([])
          } catch (e) {
            Alert.alert('错误', '清除失败')
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: headerPad, backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>最近播放</Text>
        <View style={{ width: 24 }} />
      </View>

      {plays.length > 0 && (
        <View style={[styles.actionBar, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity style={styles.playAllButton} onPress={handlePlayAll}>
            <Ionicons name="play-circle" size={18} color={colors.primary} />
            <Text style={[styles.playAllText, { color: colors.primary }]}>播放全部</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={handleClearHistory}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={[styles.clearText, { color: colors.danger }]}>清除历史</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={plays}
        keyExtractor={(item) => `${item.source}_${item.song_identifier}`}
        renderItem={({ item }) => (
          <SongItem
            song={toSong(item)}
            onPress={() => playSong(toSong(item))}
            onLongPress={() => {
              setContextSong(toSong(item))
              setShowContext(true)
            }}
          />
        )}
        removeClippedSubviews={true}
        initialNumToRender={8}
        maxToRenderPerBatch={5}
        windowSize={5}
        contentContainerStyle={plays.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无播放记录</Text>
          </View>
        }
      />
      <SongContextMenu song={contextSong} visible={showContext} onClose={() => setShowContext(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  actionBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  playAllButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  playAllText: { fontSize: 14, fontWeight: '600' },
  clearButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  clearText: { fontSize: 13 },
  emptyList: { flexGrow: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: 15, marginTop: 12 },
})
