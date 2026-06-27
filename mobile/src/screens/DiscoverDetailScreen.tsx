import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePlayerStore } from '../stores/playerStore'
import { showToast } from '../components/Toast'
import { useTheme } from '../hooks/useTheme'
import api from '../services/api'
import SongContextMenu from '../components/SongContextMenu'
import type { Song } from '../types'

interface DetailData {
  name: string
  artist?: string
  total_plays: number
  unique_listeners?: number
  song_count: number
  songs: any[]
}

export default function DiscoverDetailScreen() {
  const route = useRoute<any>()
  const navigation = useNavigation<any>()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const playSong = usePlayerStore(s => s.playSong)
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [contextSong, setContextSong] = useState<Song | null>(null)
  const [showContext, setShowContext] = useState(false)

  const type: 'artist' | 'album' = route.params?.type || 'artist'
  const name = route.params?.name || ''

  useEffect(() => { navigation.setOptions({ title: type === 'artist' ? '歌手' : '专辑' }); load() }, [])

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/discover/${type}`, { params: { name, limit: 50 } })
      setData(d)
    } catch {
      showToast('加载失败')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [type, name])

  const onRefresh = () => { setRefreshing(true); load() }

  const handlePlay = (item: any, list: any[]) => {
    const song: Song = toSong(item)
    showToast(`正在加载: ${song.song_name}`)
    playSong(song, list.map(toSong)).catch(() => {})
  }

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const song = toSong(item)
    return (
      <TouchableOpacity
        style={[styles.songRow, { borderBottomColor: colors.borderLight }]}
        onPress={() => handlePlay(item, data?.songs || [])}
        onLongPress={() => { if (song.source && song.song_identifier) { setContextSong(song); setShowContext(true) } }}
        activeOpacity={0.5}
      >
        <Text style={[styles.rank, { color: colors.textTertiary }]}>{index + 1}</Text>
        {item.cover_url ? (
          <Image source={{ uri: item.cover_url }} style={styles.cover} />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: colors.borderLight }]}>
            <Ionicons name="musical-note" size={16} color={colors.textTertiary} />
          </View>
        )}
        <View style={styles.songInfo}>
          <Text style={[styles.songName, { color: colors.text }]} numberOfLines={1}>{item.song_name || '未知'}</Text>
          <Text style={[styles.singer, { color: colors.textTertiary }]} numberOfLines={1}>
            {item.singers || '未知歌手'}{item.plays ? ` · 播放 ${item.plays}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.playBtn} onPress={() => handlePlay(item, data?.songs || [])}>
          <Ionicons name="play-circle-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={28} color={colors.text} /></TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{type === 'artist' ? '歌手' : '专辑'}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    )
  }

  const songs = data?.songs || []

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={28} color={colors.text} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{name}</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={songs}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={[styles.banner, { backgroundColor: colors.card }]}>
            <Text style={[styles.bannerTitle, { color: colors.text }]}>{name}</Text>
            {type === 'album' && data?.artist ? (
              <TouchableOpacity onPress={() => navigation.push('DiscoverDetail', { type: 'artist', name: data.artist })}>
                <Text style={[styles.bannerSub, { color: colors.primary }]}>{data.artist} ›</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.bannerStats}>
              <Stat label="曲目" value={data?.song_count ?? 0} color={colors.text} sub={colors.textTertiary} />
              <Stat label="总播放" value={data?.total_plays ?? 0} color={colors.text} sub={colors.textTertiary} />
              {type === 'artist' && <Stat label="听众" value={data?.unique_listeners ?? 0} color={colors.text} sub={colors.textTertiary} />}
            </View>
            {songs.length > 0 && (
              <TouchableOpacity
                style={[styles.playAllBtn, { backgroundColor: colors.primary }]}
                onPress={() => handlePlay(songs[0], songs)}
              >
                <Ionicons name="play" size={16} color="#fff" />
                <Text style={styles.playAllText}>播放全部</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name={type === 'artist' ? 'person-outline' : 'disc-outline'} size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无该{type === 'artist' ? '歌手' : '专辑'}的播放记录</Text>
            <TouchableOpacity
              style={[styles.searchBtn, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Main', { screen: 'Search' })}
            >
              <Text style={styles.playAllText}>去搜索「{name}」</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
      <SongContextMenu song={contextSong} visible={showContext} onClose={() => setShowContext(false)} />
    </View>
  )
}

function Stat({ label, value, color, sub }: { label: string; value: number; color: string; sub: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: sub }]}>{label}</Text>
    </View>
  )
}

function toSong(item: any): Song {
  return {
    song_name: item.song_name, singers: item.singers, album: item.album || '',
    ext: item.ext || 'mp3', file_size: '', duration: '', duration_s: item.duration_s || 0,
    source: item.source || '', song_identifier: item.song_identifier || '',
    download_url: '', cover_url: item.cover_url || '', lyric: '',
    with_valid_download_url: false,
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', marginHorizontal: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 40 },
  banner: { marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 20, alignItems: 'center' },
  bannerTitle: { fontSize: 22, fontWeight: 'bold' },
  bannerSub: { fontSize: 14, marginTop: 4 },
  bannerStats: { flexDirection: 'row', gap: 28, marginTop: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 11, marginTop: 2 },
  playAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 22, marginTop: 16 },
  playAllText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  searchBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22 },
  songRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  rank: { width: 28, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  cover: { width: 44, height: 44, borderRadius: 8, marginLeft: 4, backgroundColor: '#eee' },
  coverPlaceholder: { width: 44, height: 44, borderRadius: 8, marginLeft: 4, justifyContent: 'center', alignItems: 'center' },
  songInfo: { flex: 1, marginLeft: 10 },
  songName: { fontSize: 15 },
  singer: { fontSize: 12, marginTop: 2 },
  playBtn: { padding: 6 },
  emptyText: { fontSize: 14, textAlign: 'center' },
})
