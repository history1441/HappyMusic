import React from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useDownloadStore, DownloadTask } from '../stores/downloadStore'
import { useLibraryStore } from '../stores/libraryStore'
import { usePlayerStore } from '../stores/playerStore'
import { useHeaderPadding } from '../hooks/useHeaderPadding'
import { useTheme } from '../hooks/useTheme'
import SongItem from '../components/SongItem'
import type { Song } from '../types'

export default function DownloadManagerScreen() {
  const navigation = useNavigation()
  const { tasks, clearDone, removeTask } = useDownloadStore()
  const { loadLibrary } = useLibraryStore()
  const playSong = usePlayerStore((s) => s.playSong)
  const headerPad = useHeaderPadding()
  const { colors } = useTheme()

  useFocusEffect(
    React.useCallback(() => {
      loadLibrary()
    }, [])
  )

  const handleClearCompleted = () => {
    const completed = tasks.filter(t => t.status === 'done')
    if (completed.length === 0) {
      Alert.alert('提示', '没有已完成的任务')
      return
    }
    Alert.alert('确认清除', `确定要清除 ${completed.length} 个已完成的任务吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '清除', style: 'destructive', onPress: clearDone },
    ])
  }

  const getStatusColor = (status: DownloadTask['status']): string => {
    switch (status) {
      case 'pending': return colors.textTertiary
      case 'downloading': return colors.primary
      case 'done': return colors.success
      case 'error': return colors.danger
      default: return colors.textTertiary
    }
  }

  const getStatusText = (status: DownloadTask['status']): string => {
    switch (status) {
      case 'pending': return '等待中'
      case 'downloading': return '下载中'
      case 'done': return '已完成'
      case 'error': return '失败'
      default: return ''
    }
  }

  const handlePlayDownloaded = (task: DownloadTask) => {
    const song: Song = {
      song_name: task.song.song_name,
      singers: task.song.singers,
      album: task.song.album || '',
      ext: task.song.ext || 'mp3',
      file_size: '',
      duration: '',
      duration_s: 0,
      source: task.song.source,
      song_identifier: task.song.song_identifier,
      download_url: '',
      cover_url: task.song.cover_url || '',
      lyric: '',
      with_valid_download_url: false,
    }
    playSong(song)
  }

  const renderActiveItem = ({ item }: { item: DownloadTask }) => (
    <View style={[styles.taskRow, { backgroundColor: colors.card, borderBottomColor: colors.background }]}>
      <View style={styles.taskInfo}>
        <Text style={[styles.songName, { color: colors.text }]} numberOfLines={1}>{item.song.song_name || '未知'}</Text>
        <Text style={[styles.singerText, { color: colors.textTertiary }]} numberOfLines={1}>{item.song.singers || '未知歌手'}</Text>
      </View>
      <View style={styles.progressRow}>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${item.progress}%`, backgroundColor: getStatusColor(item.status) },
            ]}
          />
        </View>
        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
          {item.status === 'error' ? item.error || '失败' : getStatusText(item.status)}
        </Text>
        {item.status !== 'done' && (
          <Text style={[styles.percentText, { color: colors.textTertiary }]}>{item.progress}%</Text>
        )}
      </View>
      <View style={styles.taskActions}>
        {item.status === 'error' && (
          <TouchableOpacity style={styles.retryBtn} onPress={() => {
            removeTask(item.id)
            useDownloadStore.getState().addTask(item.song)
          }}>
            <Ionicons name="refresh" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
        {item.status === 'done' && (
          <TouchableOpacity style={styles.retryBtn} onPress={() => removeTask(item.id)}>
            <Ionicons name="close" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  // Separate tasks: active (pending/downloading/error) vs completed (done)
  const activeTasks = tasks.filter(t => t.status !== 'done')
  const completedTasks = tasks.filter(t => t.status === 'done')

  const allData = [
    ...activeTasks.map(t => ({ type: 'active' as const, task: t })),
    ...completedTasks.map(t => ({ type: 'completed' as const, task: t })),
  ]

  const completedCount = completedTasks.length
  const activeCount = tasks.filter(t => t.status === 'downloading' || t.status === 'pending').length
  const failedCount = tasks.filter(t => t.status === 'error').length

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: headerPad, backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>下载管理</Text>
        <View style={{ width: 24 }} />
      </View>

      {tasks.length > 0 && (
        <View style={[styles.summaryBar, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
          <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
            {activeCount > 0 ? `${activeCount} 个下载中` : '无下载任务'}
            {completedCount > 0 ? ` · ${completedCount} 个已完成` : ''}
            {failedCount > 0 ? ` · ${failedCount} 个失败` : ''}
          </Text>
          {(completedCount > 0 || failedCount > 0) && (
            <TouchableOpacity onPress={handleClearCompleted}>
              <Text style={[styles.clearLink, { color: colors.primary }]}>清除已完成</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={allData}
        keyExtractor={(item) => item.task.id}
        renderItem={({ item }) => {
          if (item.type === 'completed') {
            return (
              <SongItem
                song={item.task.song as Song}
                localStatus="downloaded"
                onPress={() => handlePlayDownloaded(item.task)}
              />
            )
          }
          return renderActiveItem({ item: item.task })
        }}
        removeClippedSubviews={true}
        initialNumToRender={8}
        maxToRenderPerBatch={5}
        windowSize={5}
        contentContainerStyle={tasks.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="download-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无下载任务</Text>
            <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>搜索歌曲后点击下载按钮</Text>
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
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  summaryText: { fontSize: 13 },
  clearLink: { fontSize: 13, fontWeight: '500' },
  taskRow: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  taskInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  songName: { fontSize: 15, fontWeight: '500', flex: 1, marginRight: 8 },
  singerText: { fontSize: 13, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  statusText: { fontSize: 12, fontWeight: '500', minWidth: 42 },
  percentText: { fontSize: 12, fontWeight: '500', minWidth: 36, textAlign: 'right' },
  taskActions: { position: 'absolute', right: 16, top: 14 },
  retryBtn: { padding: 4 },
  emptyList: { flexGrow: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: 15, marginTop: 12 },
  emptyHint: { fontSize: 13, marginTop: 4 },
})
