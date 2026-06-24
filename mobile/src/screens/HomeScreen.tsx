import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { showToast } from '../components/Toast'
import { useTheme } from '../hooks/useTheme'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import { useLibraryStore } from '../stores/libraryStore'
import SongContextMenu from '../components/SongContextMenu'
import type { Song, LocalSong } from '../types'

const quickEntries = [
  { icon: 'musical-notes' as const, label: '本地音乐', bg: '#fff3e0', color: '#f57c00', screen: '__local__' },
  { icon: 'radio' as const, label: '心情电台', bg: '#fce4ec', color: '#e91e63', screen: 'MoodRadio' },
  { icon: 'game-controller' as const, label: '猜歌游戏', bg: '#e8f5e9', color: '#43a047', screen: 'GuessGame' },
  { icon: 'sparkles' as const, label: 'AI推荐', bg: '#ede7f6', color: '#7e57c2', screen: 'AIRecommend' },
  { icon: 'flame' as const, label: '热搜榜', bg: '#fce4ec', color: '#EC4141', screen: 'HotCharts' },
  { icon: 'time' as const, label: '最近播放', bg: '#e3f2fd', color: '#1e88e5', screen: 'RecentPlays' },
  { icon: 'bar-chart' as const, label: '听歌统计', bg: '#e8f5e9', color: '#2e7d32', screen: 'Stats' },
  { icon: 'download' as const, label: '下载管理', bg: '#e0f2f1', color: '#00897b', screen: 'DownloadManager' },
]

function localToSong(ls: LocalSong): Song {
  return {
    song_name: ls.song_name, singers: ls.singers, album: ls.album,
    ext: ls.ext, file_size: String(ls.file_size), duration: String(ls.duration),
    duration_s: ls.duration, source: ls.source, song_identifier: ls.song_identifier,
    download_url: ls.file_path, cover_url: ls.cover_url, lyric: '',
    with_valid_download_url: true,
  }
}

export default function HomeScreen() {
  const [hotSongs, setHotSongs] = useState<Song[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [contextSong, setContextSong] = useState<Song | null>(null)
  const [showContext, setShowContext] = useState(false)
  const playSong = usePlayerStore(s => s.playSong)
  const insets = useSafeAreaInsets()
  const { downloads, loadLibrary } = useLibraryStore()
  const navigation = useNavigation<any>()
  const { colors } = useTheme()

  useEffect(() => { loadHot(); loadLibrary() }, [])

  const loadHot = async () => {
    try {
      const { data } = await api.get('/global-hot', { params: { period: 'day', limit: 10 } })
      const items = Array.isArray(data) ? data : []
      const songs: Song[] = items.map((item: any) => ({
        song_name: item.song_name,
        singers: item.singers,
        album: '',
        ext: item.ext || 'mp3',
        file_size: '',
        duration: '',
        duration_s: item.duration_s || 0,
        source: item.source || '',
        song_identifier: item.song_identifier || '',
        download_url: '',
        cover_url: item.cover_url || '',
        lyric: '',
        with_valid_download_url: false,
      }))
      setHotSongs(songs)
    } catch {}
    setRefreshing(false)
  }

  const onRefresh = () => { setRefreshing(true); loadHot(); loadLibrary() }

  const handlePlay = (item: Song, list: Song[]) => {
    showToast(`正在加载: ${item.song_name}`)
    playSong(item, list).catch(() => {})
  }

  const handlePlayAllLocal = () => {
    if (downloads.length === 0) {
      Alert.alert('提示', '暂无本地音乐，可先通过"导入音乐"添加')
      return
    }
    const songs = downloads.map(localToSong)
    playSong(songs[0], songs).catch(() => {})
  }

  const handleQuickLink = (screen: string) => {
    if (screen === '__local__') {
      if (downloads.length === 0) {
        navigation.navigate('LocalFileImport')
      } else {
        Alert.alert('本地音乐', `共 ${downloads.length} 首本地音乐`, [
          { text: '播放全部', onPress: handlePlayAllLocal },
          { text: '查看列表', onPress: () => navigation.navigate('LocalLibrary') },
          { text: '取消', style: 'cancel' },
        ])
      }
    } else {
      // 子页面在 SettingsNavigator 中，跨 Tab 导航
      const homeScreens = ['HotCharts', 'LocalLibrary', 'LocalFileImport']
      if (homeScreens.includes(screen)) {
        navigation.navigate(screen)
      } else {
        navigation.navigate('Settings', { screen })
      }
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
    >
      {/* 大标题 */}
      <Text style={[styles.title, { color: colors.text }]}>发现音乐</Text>

      {/* 快捷入口网格 */}
      <View style={styles.quickGrid}>
        {quickEntries.map((entry) => (
          <TouchableOpacity
            key={entry.screen}
            style={styles.quickItem}
            onPress={() => handleQuickLink(entry.screen)}
            activeOpacity={0.6}
          >
            <View style={[styles.iconWrap, { backgroundColor: entry.bg }]}>
              <Ionicons name={entry.icon} size={22} color={entry.color} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>{entry.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 热门歌曲区域 */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>热门歌曲</Text>
        <TouchableOpacity onPress={() => navigation.navigate('HotCharts')}>
          <Text style={[styles.seeAll, { color: colors.textTertiary }]}>查看全部 &gt;</Text>
        </TouchableOpacity>
      </View>

      {/* 歌曲列表 */}
      {hotSongs.length > 0 && (
        <View style={[styles.songList, { backgroundColor: colors.card }]}>
          {hotSongs.slice(0, 10).map((item, index) => (
            <TouchableOpacity
              key={`${item.source}_${item.song_identifier}_${index}`}
              style={[styles.songRow, { borderBottomColor: colors.borderLight }]}
              onPress={() => handlePlay(item, hotSongs)}
              onLongPress={() => {
                if (item.source && item.song_identifier) {
                  setContextSong(item)
                  setShowContext(true)
                }
              }}
              activeOpacity={0.5}
            >
              <Text style={[styles.rank, { color: colors.textTertiary }, index < 3 && styles.rankTop]}>
                {index + 1}
              </Text>
              {item.cover_url ? (
                <Image source={{ uri: item.cover_url }} style={styles.coverImg} />
              ) : (
                <View style={[styles.coverPlaceholder, { backgroundColor: colors.borderLight }]}>
                  <Ionicons name="musical-note" size={16} color={colors.textTertiary} />
                </View>
              )}
              <View style={styles.songInfo}>
                <Text style={[styles.songName, { color: colors.text }]} numberOfLines={1}>{item.song_name || '未知'}</Text>
                <Text style={[styles.singer, { color: colors.textTertiary }]} numberOfLines={1}>{item.singers || '未知歌手'}</Text>
              </View>
              <TouchableOpacity style={styles.playBtn} onPress={() => handlePlay(item, hotSongs)}>
                <Ionicons name="play-circle-outline" size={28} color={colors.primary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {hotSongs.length === 0 && <Text style={[styles.empty, { color: colors.textTertiary }]}>下拉刷新获取热门歌曲</Text>}
      <SongContextMenu song={contextSong} visible={showContext} onClose={() => setShowContext(false)} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  quickItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAll: {
    fontSize: 13,
    color: '#999',
  },
  songList: {
    backgroundColor: '#fff',
    marginTop: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  rank: {
    width: 28,
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textTertiary,
    textAlign: 'center',
  },
  rankTop: {
    color: '#EC4141',
  },
  coverImg: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginLeft: 8,
    backgroundColor: colors.borderLight,
  },
  coverPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginLeft: 8,
    backgroundColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songInfo: {
    flex: 1,
    marginLeft: 8,
  },
  songName: {
    fontSize: 15,
    color: colors.text,
  },
  singer: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  playBtn: {
    padding: 8,
  },
  empty: {
    textAlign: 'center',
    color: colors.textTertiary,
    marginTop: 20,
    marginBottom: 40,
    fontSize: 14,
  },
})
