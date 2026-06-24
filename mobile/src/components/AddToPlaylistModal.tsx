import React, { useEffect, useState, useCallback } from 'react'
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import api from '../services/api'
import type { Song, Playlist } from '../types'
import { useTheme } from '../hooks/useTheme'

interface Props {
  song: Song
  visible: boolean
  onClose: () => void
}

interface PlaylistItem extends Playlist {
  adding?: boolean
  added?: boolean
}

export default function AddToPlaylistModal({ song, visible, onClose }: Props) {
  const { colors } = useTheme()
  const [favorite, setFavorite] = useState<PlaylistItem | null>(null)
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([])
  const [loading, setLoading] = useState(false)

  const loadPlaylists = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/playlists')
      const all: Playlist[] = data.playlists || data || []
      const fav = all.find(p => p.is_favorite) || null
      const rest = all.filter(p => !p.is_favorite)
      setFavorite(fav ? { ...fav } : null)
      setPlaylists(rest.map(p => ({ ...p })))
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (visible) {
      loadPlaylists()
      // reset states
      if (favorite) setFavorite({ ...favorite, adding: false, added: false })
      setPlaylists(prev => prev.map(p => ({ ...p, adding: false, added: false })))
    }
  }, [visible])

  const handleAdd = async (playlist: PlaylistItem, isFav: boolean) => {
    const setter = isFav ? setFavorite : (fn: (prev: PlaylistItem[]) => PlaylistItem[]) => {
      setPlaylists(prev => fn(prev))
    }

    const markAdding = (item: PlaylistItem): PlaylistItem =>
      item.id === playlist.id ? { ...item, adding: true } : item

    const markResult = (item: PlaylistItem): PlaylistItem =>
      item.id === playlist.id
        ? { ...item, adding: false, added: true }
        : item

    const markError = (item: PlaylistItem): PlaylistItem =>
      item.id === playlist.id ? { ...item, adding: false } : item

    if (isFav) {
      setFavorite(prev => prev ? { ...prev, adding: true } : prev)
    } else {
      setPlaylists(prev => prev.map(markAdding))
    }

    try {
      await api.post(`/playlists/${playlist.id}/songs`, {
        song_name: song.song_name,
        singers: song.singers,
        album: song.album,
        ext: song.ext,
        duration: song.duration_s || 0,
        file_size: song.file_size || '',
        source: song.source,
        song_identifier: song.song_identifier,
        cover_url: song.cover_url,
      })

      if (isFav) {
        setFavorite(prev => prev ? { ...prev, adding: false, added: true } : prev)
      } else {
        setPlaylists(prev => prev.map(markResult))
      }
    } catch (e: any) {
      const msg = e.response?.data?.detail || e.message || ''
      // If song already exists, mark as added gracefully
      if (msg.includes('已存在') || msg.includes('already')) {
        if (isFav) {
          setFavorite(prev => prev ? { ...prev, adding: false, added: true } : prev)
        } else {
          setPlaylists(prev => prev.map(markResult))
        }
      } else {
        if (isFav) {
          setFavorite(prev => prev ? { ...prev, adding: false } : prev)
        } else {
          setPlaylists(prev => prev.map(markError))
        }
      }
    }
  }

  const renderItem = (item: PlaylistItem, isFav: boolean) => (
    <TouchableOpacity
      style={styles.playlistItem}
      onPress={() => handleAdd(item, isFav)}
      disabled={item.adding}
      activeOpacity={0.7}
    >
      <View style={[styles.playlistIcon, { backgroundColor: colors.borderLight }]}>
        <Text style={[styles.iconText, { color: colors.primary }]}>
          {isFav ? '♥' : '≡'}
        </Text>
      </View>
      <View style={styles.playlistInfo}>
        <Text style={[styles.playlistName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.playlistCount, { color: colors.textTertiary }]}>
          {item.song_count} 首歌曲
        </Text>
      </View>
      <View style={styles.playlistAction}>
        {item.adding ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : item.added ? (
          <Text style={[styles.checkmark, { color: colors.success }]}>✓</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.container, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.title, { color: colors.text }]}>添加到歌单</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: colors.textTertiary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.songInfo, { color: colors.textSecondary }]} numberOfLines={1}>
            {song.song_name} - {song.singers}
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={item => item.id.toString()}
              ListHeaderComponent={
                favorite ? (
                  <View>{renderItem(favorite, true)}</View>
                ) : null
              }
              renderItem={({ item }) => renderItem(item, false)}
              ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.borderLight }]} />}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无歌单</Text>
                </View>
              }
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 20,
  },
  songInfo: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 14,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  playlistIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontSize: 15,
    fontWeight: '600',
  },
  playlistCount: {
    fontSize: 12,
    marginTop: 2,
  },
  playlistAction: {
    width: 30,
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 20,
    fontWeight: '700',
  },
  separator: {
    height: 1,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
})
