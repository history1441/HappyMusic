import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import Slider from '@react-native-community/slider'
import TrackPlayer from 'react-native-track-player'
import { usePlayerStore } from '../stores/playerStore'
import { formatDuration } from '../utils/format'
import { useHeaderPadding } from '../hooks/useHeaderPadding'

const MAX_DURATION = 30 // max 30 seconds for ringtone

export default function RingtoneMakerScreen() {
  const navigation = useNavigation()
  const currentSong = usePlayerStore((s) => s.currentSong)
  const duration = usePlayerStore((s) => s.duration)
  const headerPad = useHeaderPadding()

  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(Math.min(MAX_DURATION, duration || MAX_DURATION))
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewPosition, setPreviewPosition] = useState(0)

  const previewInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (duration > 0) {
      setEndTime(Math.min(MAX_DURATION, duration))
    }
  }, [duration])

  useEffect(() => {
    return () => {
      stopPreview()
    }
  }, [])

  const stopPreview = async () => {
    if (previewInterval.current) {
      clearInterval(previewInterval.current)
      previewInterval.current = null
    }
    setIsPreviewing(false)
    try {
      await TrackPlayer.pause()
    } catch {}
  }

  const playPreview = async () => {
    if (!currentSong) return

    try {
      if (isPreviewing) {
        await stopPreview()
        return
      }

      setIsPreviewing(true)
      setPreviewPosition(startTime)
      await TrackPlayer.seekTo(startTime)
      await TrackPlayer.play()

      previewInterval.current = setInterval(async () => {
        try {
          const progress = await TrackPlayer.getProgress()
          setPreviewPosition(progress.position)

          if (progress.position >= endTime) {
            await stopPreview()
          }
        } catch {
          await stopPreview()
        }
      }, 200)
    } catch (e) {
      Alert.alert('错误', '预览失败')
      setIsPreviewing(false)
    }
  }

  const handleStartTimeChange = (value: number) => {
    setStartTime(value)
    if (value >= endTime) {
      setEndTime(Math.min(value + MAX_DURATION, duration || value + MAX_DURATION))
    }
    // Ensure range doesn't exceed 30s
    if (endTime - value > MAX_DURATION) {
      setEndTime(value + MAX_DURATION)
    }
  }

  const handleEndTimeChange = (value: number) => {
    if (value - startTime > MAX_DURATION) {
      setEndTime(startTime + MAX_DURATION)
    } else {
      setEndTime(value)
    }
  }

  const handleExport = () => {
    Alert.alert('提示', '功能开发中')
  }

  const selectedDuration = endTime - startTime

  if (!currentSong) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: headerPad }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>铃声制作</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.noSongContainer}>
          <Ionicons name="musical-note-outline" size={64} color="#cbd5e1" />
          <Text style={styles.noSongText}>请先播放一首歌</Text>
          <Text style={styles.noSongHint}>返回并播放歌曲后即可制作铃声</Text>
        </View>
      </View>
    )
  }

  const maxEnd = Math.min(startTime + MAX_DURATION, duration || startTime + MAX_DURATION)
  const sliderMax = duration || 100

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>铃声制作</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.songInfoCard}>
        <View style={styles.songInfoIcon}>
          <Ionicons name="musical-note" size={24} color="#EC4141" />
        </View>
        <View style={styles.songInfoText}>
          <Text style={styles.currentSongName} numberOfLines={1}>{currentSong.song_name}</Text>
          <Text style={styles.currentSongArtist} numberOfLines={1}>{currentSong.singers}</Text>
        </View>
      </View>

      <View style={styles.editorSection}>
        <Text style={styles.sectionTitle}>选择片段</Text>
        <Text style={styles.sectionHint}>最长 {MAX_DURATION} 秒</Text>

        {/* Visual range indicator */}
        <View style={styles.rangeContainer}>
          <View style={styles.rangeTrack}>
            <View
              style={[
                styles.rangeSelected,
                {
                  left: `${(startTime / sliderMax) * 100}%`,
                  width: `${((endTime - startTime) / sliderMax) * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        {/* Start time slider */}
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>开始</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={Math.max(0, sliderMax - 1)}
            value={startTime}
            onValueChange={handleStartTimeChange}
            minimumTrackTintColor="#EC4141"
            maximumTrackTintColor="#e2e8f0"
            thumbTintColor="#EC4141"
          />
          <Text style={styles.sliderTime}>{formatDuration(startTime)}</Text>
        </View>

        {/* End time slider */}
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>结束</Text>
          <Slider
            style={styles.slider}
            minimumValue={Math.max(0, startTime + 1)}
            maximumValue={maxEnd}
            value={endTime}
            onValueChange={handleEndTimeChange}
            minimumTrackTintColor="#EC4141"
            maximumTrackTintColor="#e2e8f0"
            thumbTintColor="#EC4141"
          />
          <Text style={styles.sliderTime}>{formatDuration(endTime)}</Text>
        </View>

        <View style={styles.selectedInfo}>
          <Text style={styles.selectedDuration}>
            已选择: {formatDuration(selectedDuration)}
          </Text>
          {selectedDuration > MAX_DURATION && (
            <Text style={styles.warningText}>铃声不能超过 {MAX_DURATION} 秒</Text>
          )}
        </View>
      </View>

      <View style={styles.actionSection}>
        <TouchableOpacity
          style={[styles.previewButton, isPreviewing && styles.previewButtonActive]}
          onPress={playPreview}
        >
          <Ionicons
            name={isPreviewing ? 'pause' : 'play'}
            size={20}
            color="#fff"
          />
          <Text style={styles.previewButtonText}>
            {isPreviewing ? '停止预览' : '预览片段'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Ionicons name="download" size={20} color="#fff" />
          <Text style={styles.exportButtonText}>导出铃声</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  noSongContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  noSongText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
  },
  noSongHint: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  songInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  songInfoIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  songInfoText: {
    flex: 1,
  },
  currentSongName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  currentSongArtist: {
    fontSize: 13,
    color: '#94a3b8',
  },
  editorSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
  },
  rangeContainer: {
    marginBottom: 20,
  },
  rangeTrack: {
    height: 32,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  rangeSelected: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#EC4141',
    borderRadius: 6,
    opacity: 0.3,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sliderLabel: {
    fontSize: 13,
    color: '#64748b',
    width: 36,
    fontWeight: '500',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderTime: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '500',
    width: 44,
    textAlign: 'right',
  },
  selectedInfo: {
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedDuration: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EC4141',
  },
  warningText: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 4,
  },
  actionSection: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 40,
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EC4141',
    paddingVertical: 14,
    borderRadius: 12,
  },
  previewButtonActive: {
    backgroundColor: '#4f46e5',
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
})
