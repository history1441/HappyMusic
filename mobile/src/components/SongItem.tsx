import React, { useState, useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import CacheBadge from './CacheBadge'
import { showToast } from './Toast'
import { useDownloadStore } from '../stores/downloadStore'
import { useTheme } from '../hooks/useTheme'
import { formatDuration, formatSize } from '../utils/format'
import api from '../services/api'
import type { Song } from '../types'

// Stable selector: uses song key to find task without bind() anti-pattern
function useDownloadTaskKey(songKey: string) {
  return useDownloadStore(s => {
    const task = s.tasks.find(t => t.id === songKey)
    return { task, addTask: s.addTask }
  })
}

export const SongItem = React.memo(function SongItem({ song, localStatus, onPress, onLongPress, showDownload = true, isFavorite, onToggleFavorite, onPlayNext }: Props) {
  const songKey = `${song.source}_${song.song_identifier}`
  const { task, addTask } = useDownloadTaskKey(songKey)
  const { colors } = useTheme()
  const [localStatusState, setLocalStatusState] = useState(localStatus)

  const isDownloaded = localStatusState === 'downloaded' || task?.status === 'done'
  const isDownloading = task?.status === 'downloading' || task?.status === 'pending'
  const downloadProgress = task?.progress || 0

  // Memoize expensive calculations
  const durationSec = useMemo(() => song.duration_s || (song.duration ? parseFloat(song.duration) : 0), [song.duration_s, song.duration])

  const fileSizeNum = useMemo(() => {
    const raw = song.file_size
    if (!raw) return 0
    const match = raw.match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i)
    if (match) {
      const num = parseFloat(match[1])
      const unit = match[2].toUpperCase()
      const m = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 }
      return num * (m[unit] || 1)
    }
    const n = parseFloat(raw)
    return isNaN(n) ? 0 : n
  }, [song.file_size])

  const qualityLabel = useMemo(() => {
    if (!fileSizeNum || !durationSec) return null
    const bitrate = (fileSizeNum * 8) / durationSec / 1000
    if (bitrate > 800) return '无损'
    if (bitrate > 250) return 'HQ'
    if (bitrate > 100) return '标准'
    return null
  }, [fileSizeNum, durationSec])

  const handleDownload = useCallback(async () => {
    if (isDownloaded || isDownloading) return
    showToast(`开始下载 ${song.song_name}`)
    await addTask(song)
  }, [song, isDownloaded, isDownloading, addTask])

  const sourceLabel = useMemo(() => {
    const labels: Record<string, string> = {
      qq: 'QQ音乐', wy: '网易云', kg: '酷狗', kw: '酷我音乐', mg: '咪咕音乐',
      netease: '网易云', qqmusic: 'QQ音乐', kugou: '酷狗', kuwo: '酷我音乐', migu: '咪咕音乐',
      QQMusicClient: 'QQ音乐',
      KuwoMusicClient: '酷我音乐',
      MiguMusicClient: '咪咕音乐',
      NeteaseMusicClient: '网易云',
      KugouMusicClient: '酷狗音乐',
      QianqianMusicClient: '千千音乐',
      BilibiliMusicClient: 'B站',
      AppleMusicClient: 'Apple Music',
    }
    return labels[song.source || ''] || song.source
  }, [song.source])

  const ql = qualityLabel

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      delayLongPress={300}
    >
      <View style={[styles.cover, { backgroundColor: colors.primary }]}>
        {song.cover_url ? (
          <Image source={{ uri: song.cover_url }} style={styles.coverImage} />
        ) : (
          <Ionicons name="musical-note" size={20} color="#fff" />
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{song.song_name || '未知'}</Text>
          {ql && (
            <View style={[styles.qualityBadge, ql === '无损' && styles.losslessBadge]}>
              <Text style={styles.qualityText}>{ql}</Text>
            </View>
          )}
          {sourceLabel && (
            <View style={[styles.sourceBadge, { backgroundColor: colors.borderLight }]}>
              <Text style={[styles.sourceBadgeText, { color: colors.textTertiary }]}>{sourceLabel}</Text>
            </View>
          )}
          {localStatusState && <CacheBadge status={localStatusState as any} />}
        </View>
        <Text style={[styles.singer, { color: colors.textTertiary }]} numberOfLines={1}>
          {song.singers || '未知歌手'}{song.album ? ` · ${song.album}` : ''}
        </Text>
        <View style={styles.metaRow}>
          {durationSec > 0 && (
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{formatDuration(durationSec)}</Text>
          )}
          {fileSizeNum > 0 && (
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{formatSize(fileSizeNum)}</Text>
          )}
          {song.ext && <Text style={[styles.metaText, { color: colors.textTertiary }]}>{song.ext.toUpperCase()}</Text>}
        </View>
      </View>
      <View style={styles.actions}>
        {onToggleFavorite && (
          <TouchableOpacity style={styles.actionBtn} onPress={onToggleFavorite}>
            <Ionicons name="heart" size={18} color={isFavorite ? colors.danger : colors.border} />
          </TouchableOpacity>
        )}
        {onPlayNext && (
          <TouchableOpacity style={styles.actionBtn} onPress={onPlayNext}>
            <Ionicons name="play-skip-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
        {showDownload && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleDownload}
            disabled={isDownloaded || isDownloading}
          >
            {isDownloading ? (
              <View style={styles.progressCircle}>
                <ActivityIndicator size="small" color={colors.primary} />
                {downloadProgress > 0 && (
                  <Text style={[styles.progressText, { color: colors.primary }]}>{downloadProgress}%</Text>
                )}
              </View>
            ) : isDownloaded ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            ) : (
              <Ionicons name="download-outline" size={22} color={colors.primary} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  )
})

interface Props {
  song: Song
  localStatus?: string | null
  onPress: () => void
  onLongPress?: () => void
  showDownload?: boolean
  isFavorite?: boolean
  onToggleFavorite?: () => void
  onPlayNext?: () => void
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  cover: {
    width: 48, height: 48, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  info: { flex: 1, marginLeft: 12, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 15, fontWeight: '500', flexShrink: 1 },
  qualityBadge: {
    paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3,
    backgroundColor: '#dbeafe',
  },
  losslessBadge: { backgroundColor: '#fef3c7' },
  qualityText: { fontSize: 9, color: '#3b82f6', fontWeight: '600' },
  sourceBadge: { marginLeft: 6, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  sourceBadgeText: { fontSize: 10 },
  singer: { fontSize: 13 },
  metaRow: { flexDirection: 'row', gap: 8 },
  metaText: { fontSize: 11 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionBtn: { padding: 6 },
  progressCircle: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  progressText: { fontSize: 8, fontWeight: '600', position: 'absolute', bottom: -2 },
})
