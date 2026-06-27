import React, { useState, useEffect, useCallback } from 'react'
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { Song } from '../types'
import AddToPlaylistModal from './AddToPlaylistModal'
import { usePlayerStore } from '../stores/playerStore'
import { showToast } from './Toast'
import { useTheme } from '../hooks/useTheme'
import api from '../services/api'

interface Props {
  song: Song | null
  visible: boolean
  onClose: () => void
}

export default function SongContextMenu({ song, visible, onClose }: Props) {
  const addToNext = usePlayerStore((s) => s.addToNext)
  const navigation = useNavigation<any>()
  const { colors } = useTheme()
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [isFav, setIsFav] = useState(false)
  const [favPlaylistId, setFavPlaylistId] = useState<number | null>(null)

  const checkFav = useCallback(async () => {
    if (!song) return
    try {
      const { data } = await api.get('/playlists')
      const all = data.playlists || data || []
      const fav = all.find((p: any) => p.is_favorite)
      setFavPlaylistId(fav?.id ?? null)
      if (fav) {
        const exists = fav.songs?.some(
          (s: any) => s.source === song.source && s.song_identifier === song.song_identifier
        )
        setIsFav(!!exists)
      } else {
        setIsFav(false)
      }
    } catch {}
  }, [song])

  useEffect(() => {
    if (visible && song) checkFav()
  }, [visible, song, checkFav])

  const handleAddToPlaylist = () => {
    onClose()
    setShowPlaylistModal(true)
  }

  const handlePlayNext = () => {
    if (song) {
      addToNext(song)
      showToast('已添加到下一首播放')
    }
    onClose()
  }

  const handleToggleFav = async () => {
    if (!song) return
    try {
      let pid = favPlaylistId
      if (!pid) {
        const { data: created } = await api.post('/playlists', { name: '我喜欢的', is_favorite: true })
        pid = created.id
        setFavPlaylistId(pid)
      }
      if (isFav) {
        const { data: pl } = await api.get(`/playlists/${pid}`)
        const existing = (pl.songs || []).find(
          (s: any) => s.source === song.source && s.song_identifier === song.song_identifier
        )
        if (existing) await api.delete(`/playlists/${pid}/songs/${existing.id}`)
        setIsFav(false)
        showToast('已取消收藏')
      } else {
        await api.post(`/playlists/${pid}/songs`, {
          song_name: song.song_name, singers: song.singers, album: song.album,
          ext: song.ext, duration: song.duration_s || 0, file_size: song.file_size || '',
          source: song.source, song_identifier: song.song_identifier, cover_url: song.cover_url,
        })
        setIsFav(true)
        showToast('已收藏')
      }
    } catch {
      showToast('操作失败')
    }
    onClose()
  }

  return (
    <>
      <Modal visible={visible && !showPlaylistModal} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.container, { backgroundColor: colors.card }]} onPress={() => {}}>
            {song && (
              <View style={styles.songInfo}>
                <Text style={[styles.songName, { color: colors.text }]} numberOfLines={1}>{song.song_name}</Text>
                <Text style={[styles.singerText, { color: colors.textTertiary }]} numberOfLines={1}>{song.singers}</Text>
              </View>
            )}
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

            <TouchableOpacity style={styles.menuItem} onPress={handleAddToPlaylist} activeOpacity={0.6}>
              <Ionicons name="list-outline" size={20} color={colors.text} />
              <Text style={[styles.menuText, { color: colors.text }]}>添加到歌单</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handlePlayNext} activeOpacity={0.6}>
              <Ionicons name="play-skip-forward" size={20} color={colors.text} />
              <Text style={[styles.menuText, { color: colors.text }]}>下一首播放</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleToggleFav} activeOpacity={0.6}>
              <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={20} color={isFav ? colors.danger : colors.text} />
              <Text style={[styles.menuText, { color: isFav ? colors.danger : colors.text }]}>{isFav ? '取消收藏' : '收藏'}</Text>
            </TouchableOpacity>

            {song?.singers ? (
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.6}
                onPress={() => { const n = song.singers; onClose(); navigation.navigate('DiscoverDetail', { type: 'artist', name: n }) }}>
                <Ionicons name="person-outline" size={20} color={colors.text} />
                <Text style={[styles.menuText, { color: colors.text }]}>查看歌手</Text>
              </TouchableOpacity>
            ) : null}
            {song?.album ? (
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.6}
                onPress={() => { const n = song.album; onClose(); navigation.navigate('DiscoverDetail', { type: 'album', name: n }) }}>
                <Ionicons name="disc-outline" size={20} color={colors.text} />
                <Text style={[styles.menuText, { color: colors.text }]}>查看专辑</Text>
              </TouchableOpacity>
            ) : null}

            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.6}>
              <Text style={[styles.cancelText, { color: colors.textTertiary }]}>取消</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {song && (
        <AddToPlaylistModal
          song={song}
          visible={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 16,
  },
  songInfo: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  songName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  singerText: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  menuText: {
    fontSize: 15,
    color: '#1e293b',
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    color: '#94a3b8',
  },
})
