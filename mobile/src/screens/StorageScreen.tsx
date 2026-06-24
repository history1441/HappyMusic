import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, FlatList } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { getStorageInfo } from '../services/downloadService'
import { clearAllCache, deleteCacheItem } from '../services/storageService'
import { formatSize } from '../utils/format'
import { useLibraryStore } from '../stores/libraryStore'
import { useHeaderPadding } from '../hooks/useHeaderPadding'
import { useTheme } from '../hooks/useTheme'
import type { LocalSong } from '../types'

export default function StorageScreen() {
  const navigation = useNavigation()
  const [storage, setStorage] = useState({ total: 0, free: 0, downloadSize: 0, cacheSize: 0 })
  const { cache, loadLibrary } = useLibraryStore()
  const headerPad = useHeaderPadding()
  const { colors } = useTheme()

  useEffect(() => { loadStorage(); loadLibrary() }, [])

  const loadStorage = async () => {
    try {
      const info = await getStorageInfo()
      setStorage(info)
    } catch {}
  }

  const handleClearCache = () => {
    Alert.alert('清除缓存', '确定清除所有缓存音乐？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除', style: 'destructive', onPress: async () => {
          await clearAllCache()
          await loadStorage()
          await loadLibrary()
          Alert.alert('完成', '缓存已清除')
        },
      },
    ])
  }

  const usedPercent = storage.total > 0 ? ((storage.total - storage.free) / storage.total * 100).toFixed(1) : '0'
  const cachePercent = storage.total > 0 ? (storage.cacheSize / storage.total * 100).toFixed(1) : '0'
  const dlPercent = storage.total > 0 ? (storage.downloadSize / storage.total * 100).toFixed(1) : '0'

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: headerPad, backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>存储空间</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>存储空间</Text>
          <View style={[styles.barBg, { backgroundColor: colors.border }]}>
            <View style={[styles.barUsed, { width: (parseFloat(usedPercent) || 0) + '%' as any }]} />
          </View>
          <View style={styles.stats}>
            <Text style={[styles.statText, { color: colors.textSecondary }]}>已用: {formatSize(storage.total - storage.free)}</Text>
            <Text style={[styles.statText, { color: colors.textSecondary }]}>可用: {formatSize(storage.free)}</Text>
            <Text style={[styles.statText, { color: colors.textSecondary }]}>总计: {formatSize(storage.total)}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>空间占用</Text>
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>下载音乐: {formatSize(storage.downloadSize)}</Text>
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>缓存音乐: {formatSize(storage.cacheSize)}</Text>
        </View>

        <TouchableOpacity style={styles.clearBtn} onPress={handleClearCache}>
          <Text style={styles.clearBtnText}>一键清除缓存</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>缓存音乐 ({cache.length})</Text>
        <FlatList
          data={cache}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View style={[styles.cacheItem, { backgroundColor: colors.card }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cacheName, { color: colors.text }]} numberOfLines={1}>{item.song_name}</Text>
                <Text style={[styles.cacheDetail, { color: colors.textTertiary }]}>{formatSize(item.file_size)}</Text>
              </View>
              <TouchableOpacity onPress={async () => {
                await deleteCacheItem((item as any).id, item.file_path)
                loadStorage(); loadLibrary()
              }}>
                <Text style={styles.deleteText}>删除</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textTertiary }]}>暂无缓存</Text>}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  barBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barUsed: { height: '100%', backgroundColor: '#EC4141', borderRadius: 4 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  statText: { fontSize: 13 },
  detailText: { fontSize: 15, marginTop: 6 },
  clearBtn: { backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  clearBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  cacheItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginBottom: 6 },
  cacheName: { fontSize: 14 },
  cacheDetail: { fontSize: 12, marginTop: 2 },
  deleteText: { color: '#ef4444', fontSize: 13, marginLeft: 12 },
  empty: { textAlign: 'center', marginTop: 20 },
})
