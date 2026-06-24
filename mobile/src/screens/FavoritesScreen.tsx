import React, { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../services/api'
import { useTheme } from '../hooks/useTheme'

export default function FavoritesScreen() {
  const [favPlaylistId, setFavPlaylistId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const navigation = useNavigation<any>()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  useEffect(() => {
    api.get('/playlists').then(({ data }) => {
      const playlists = data.playlists || data || []
      const fav = playlists.find((p: any) => p.is_favorite)
      if (fav) setFavPlaylistId(fav.id)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>我喜欢的</Text>
          <View style={{ width: 24 }} />
        </View>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!favPlaylistId) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>我喜欢的</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="heart-outline" size={48} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无收藏歌曲</Text>
          <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>播放歌曲时点击心形按钮收藏</Text>
        </View>
      </View>
    )
  }

  // 传 name（不是 playlistName），匹配 PlaylistDetailScreen 的解构
  const PlaylistDetailScreen = require('./PlaylistDetailScreen').default
  return <PlaylistDetailScreen route={{ params: { playlistId: favPlaylistId, name: '我喜欢的' } } as any} />
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', marginHorizontal: 12 },
  emptyText: { fontSize: 16, marginTop: 12 },
  emptyHint: { fontSize: 13, marginTop: 4 },
})
