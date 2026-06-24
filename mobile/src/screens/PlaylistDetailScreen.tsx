import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRoute, useNavigation } from '@react-navigation/native'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import { useHeaderPadding } from '../hooks/useHeaderPadding'
import SongItem from '../components/SongItem'
import SongContextMenu from '../components/SongContextMenu'
import { showToast } from '../components/Toast'
import type { Song, PlaylistSong } from '../types'

export default function PlaylistDetailScreen() {
  const route = useRoute<any>()
  const navigation = useNavigation<any>()
  const { playlistId, name } = route.params || {}
  const [songs, setSongs] = useState<(PlaylistSong & { localStatus?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const { playSong, addToNext } = usePlayerStore(s => ({ playSong: s.playSong, addToNext: s.addToNext }))
  const headerPad = useHeaderPadding()
  const [contextSong, setContextSong] = useState<Song | null>(null)
  const [showContext, setShowContext] = useState(false)

  useEffect(() => { loadSongs() }, [playlistId])

  const loadSongs = async () => {
    if (!playlistId) return
    setLoading(true)
    try {
      const { data } = await api.get(`/playlists/${playlistId}`)
      setSongs(data.songs || [])
    } catch {}
    setLoading(false)
  }

  const toSong = (ps: PlaylistSong): Song => ({
    song_name: ps.song_name, singers: ps.singers, album: ps.album || '',
    ext: ps.ext || 'mp3', file_size: ps.file_size || '', duration: String(ps.duration),
    duration_s: ps.duration, source: ps.source, song_identifier: ps.song_identifier,
    download_url: '', cover_url: ps.cover_url || '', lyric: '', with_valid_download_url: false,
  })

  const handlePlay = (song: PlaylistSong) => {
    playSong(toSong(song), songs.map(toSong))
  }

  const handlePlayAll = () => {
    if (songs.length === 0) return
    playSong(toSong(songs[0]), songs.map(toSong))
  }

  const handleRemoveSong = (song: PlaylistSong) => {
    Alert.alert('移除歌曲', `确定从歌单移除 "${song.song_name}"？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '移除', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/playlists/${playlistId}/songs/${song.id}`)
            loadSongs()
          } catch {}
        },
      },
    ])
  }

  const renderItem = ({ item }: { item: PlaylistSong }) => {
    const song = toSong(item)
    return (
      <SongItem
        song={song}
        showDownload
        onPress={() => handlePlay(item)}
        onLongPress={() => { setContextSong(song); setShowContext(true) }}
        onPlayNext={() => {
          addToNext(song)
          showToast(`已添加 ${song.song_name} 到播放列表`)
        }}
      />
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.actionBar}>
        <Text style={styles.songCount}>{songs.length} 首</Text>
        {songs.length > 0 && (
          <TouchableOpacity style={styles.playAllBtn} onPress={handlePlayAll}>
            <Ionicons name="play-circle" size={18} color="#EC4141" />
            <Text style={styles.playAllText}>播放全部</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#EC4141" />
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          refreshing={loading}
          onRefresh={loadSongs}
          ListEmptyComponent={<Text style={styles.empty}>暂无歌曲</Text>}
        />
      )}

      <SongContextMenu song={contextSong} visible={showContext} onClose={() => setShowContext(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginHorizontal: 12 },
  actionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  songCount: { fontSize: 13, color: '#94a3b8' },
  playAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ede9fe', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  playAllText: { fontSize: 13, color: '#EC4141', fontWeight: '500' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
})
