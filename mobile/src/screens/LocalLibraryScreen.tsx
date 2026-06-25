import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { usePlayerStore } from '../stores/playerStore'
import { useLibraryStore } from '../stores/libraryStore'
import { deleteDownload } from '../services/downloadService'
import { deleteCacheItem } from '../services/storageService'
import { useHeaderPadding } from '../hooks/useHeaderPadding'
import { useTheme } from '../hooks/useTheme'
import SongItem from '../components/SongItem'
import SongContextMenu from '../components/SongContextMenu'
import CacheBadge from '../components/CacheBadge'
import type { LocalSong } from '../types'
import type { Song } from '@happymusic/common'

type TabType = 'downloads' | 'cache'

export default function LocalLibraryScreen() {
  const [tab, setTab] = useState<TabType>('downloads')
  const { downloads, cache, loadLibrary } = useLibraryStore()
  const playSong = usePlayerStore(s => s.playSong)
  const headerPad = useHeaderPadding()
  const navigation = useNavigation<any>()
  const { colors } = useTheme()

  useEffect(() => { loadLibrary() }, [])

  const data = tab === 'downloads' ? downloads : cache

  const toSong = (s: LocalSong): Song => ({
    song_name: s.song_name, singers: s.singers, album: s.album,
    ext: s.ext, file_size: String(s.file_size), duration: String(s.duration),
    duration_s: s.duration, source: s.source, song_identifier: s.song_identifier,
    download_url: s.file_path, cover_url: s.cover_url, lyric: '',
    with_valid_download_url: true,
  })

  const handlePlay = (song: LocalSong) => {
    playSong(toSong(song), data.map(toSong))
  }

  const handleDelete = (song: LocalSong) => {
    Alert.alert('确认删除', `删除 "${song.song_name}"？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive', onPress: async () => {
          if (tab === 'downloads') {
            await deleteDownload(song.source, song.song_identifier)
          } else {
            await deleteCacheItem((song as any).id, song.file_path)
          }
          loadLibrary()
        },
      },
    ])
  }

  const renderItem = ({ item }: { item: LocalSong }) => (
    <SongItem
      song={toSong(item)}
      localStatus={tab === 'downloads' ? 'downloaded' : 'cached'}
      onPress={() => handlePlay(item)}
      onLongPress={() => {}}
      showDownload={false}
    />
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: headerPad, backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>本地音乐</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, { borderColor: colors.border }, tab === 'downloads' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => setTab('downloads')}
        >
          <Text style={[styles.tabText, { color: colors.textSecondary }, tab === 'downloads' && styles.activeTabText]}>
            下载 ({downloads.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, { borderColor: colors.border }, tab === 'cache' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => setTab('cache')}
        >
          <Text style={[styles.tabText, { color: colors.textSecondary }, tab === 'cache' && styles.activeTabText]}>
            缓存 ({cache.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        removeClippedSubviews={true}
        initialNumToRender={8}
        maxToRenderPerBatch={5}
        windowSize={5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={48} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, marginTop: 8 }}>暂无{tab === 'downloads' ? '下载' : '缓存'}音乐</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  tabs: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', borderWidth: 1,
  },
  activeTabText: { color: '#fff', fontWeight: '600' },
  tabText: { fontSize: 14 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
})
