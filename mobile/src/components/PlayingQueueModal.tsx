import React from 'react'
import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { usePlayerStore } from '../stores/playerStore'
import { useTheme } from '../hooks/useTheme'

interface Props {
  visible: boolean
  onClose: () => void
}

export default function PlayingQueueModal({ visible, onClose }: Props) {
  const { colors } = useTheme()
  const queue = usePlayerStore(s => s.queue)
  const queueIndex = usePlayerStore(s => s.queueIndex)
  const playSong = usePlayerStore(s => s.playSong)
  const currentSong = usePlayerStore(s => s.currentSong)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.container, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.title, { color: colors.text }]}>播放列表 ({queue.length})</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {queue.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="musical-notes-outline" size={36} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>播放列表为空</Text>
            </View>
          ) : (
            <FlatList
              data={queue}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item, index }) => {
                const isActive = index === queueIndex
                return (
                  <TouchableOpacity
                    style={[styles.songRow, { borderBottomColor: colors.borderLight }, isActive && { backgroundColor: colors.primary + '10' }]}
                    onPress={() => { playSong(item, queue); onClose() }}
                    activeOpacity={0.6}
                  >
                    {isActive ? (
                      <Ionicons name="volume-high" size={16} color={colors.primary} style={styles.icon} />
                    ) : (
                      <Text style={[styles.indexText, { color: colors.textTertiary }]}>{index + 1}</Text>
                    )}
                    <View style={styles.songInfo}>
                      <Text style={[styles.songName, { color: colors.text }, isActive && { color: colors.primary, fontWeight: '600' }]} numberOfLines={1}>
                        {item.song_name}
                      </Text>
                      <Text style={[styles.singer, { color: colors.textTertiary }]} numberOfLines={1}>{item.singers}</Text>
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  container: {
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    maxHeight: '60%', paddingBottom: 20,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { marginTop: 8, fontSize: 14 },
  songRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 28, textAlign: 'center' },
  indexText: { width: 28, textAlign: 'center', fontSize: 14 },
  songInfo: { flex: 1, marginLeft: 8 },
  songName: { fontSize: 15 },
  singer: { fontSize: 12, marginTop: 2 },
})
