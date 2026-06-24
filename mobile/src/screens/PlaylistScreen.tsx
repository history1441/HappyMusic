import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, StyleSheet, RefreshControl, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../services/api'
import type { Playlist } from '../types'

export default function PlaylistScreen() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [editPl, setEditPl] = useState<Playlist | null>(null)
  const [editName, setEditName] = useState('')
  const navigation = useNavigation<any>()
  const insets = useSafeAreaInsets()

  useEffect(() => { loadPlaylists() }, [])

  const loadPlaylists = async () => {
    try {
      const { data } = await api.get('/playlists')
      setPlaylists(data.playlists || data || [])
    } catch {}
    setRefreshing(false)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await api.post('/playlists', { name: newName, description: '' })
      setShowCreate(false)
      setNewName('')
      loadPlaylists()
    } catch (e: any) {
      Alert.alert('错误', e?.response?.data?.detail || '创建失败')
    }
  }

  const handleDelete = (pl: Playlist) => {
    Alert.alert('删除歌单', `确定删除 "${pl.name}"？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive', onPress: async () => {
          try { await api.delete(`/playlists/${pl.id}`) } catch {}
          loadPlaylists()
        },
      },
    ])
  }

  const handleEdit = async () => {
    if (!editPl || !editName.trim()) return
    try {
      await api.put(`/playlists/${editPl.id}`, { name: editName, description: editPl.description || '' })
      setEditPl(null)
      setEditName('')
      loadPlaylists()
    } catch {}
  }

  const renderItem = ({ item }: { item: Playlist }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id, name: item.name })}
      onLongPress={() => { setEditPl(item); setEditName(item.name) }}
    >
      <View style={[styles.cover, item.is_favorite && styles.favCover]}>
        {item.is_favorite ? (
          <Ionicons name="heart" size={22} color="#fff" />
        ) : (
          <Text style={styles.coverText}>{item.name[0]}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.count}>{item.song_count} 首</Text>
      </View>
      {!item.is_favorite && (
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.delBtn}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Create button */}
      <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
        <Ionicons name="add" size={20} color="#EC4141" />
        <Text style={styles.createText}>新建歌单</Text>
      </TouchableOpacity>

      <FlatList
        data={playlists}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPlaylists() }} />}
        ListEmptyComponent={<Text style={styles.empty}>暂无歌单</Text>}
      />

      {/* Create Modal */}
      <Modal visible={showCreate} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>新建歌单</Text>
            <TextInput style={styles.modalInput} placeholder="歌单名称" value={newName} onChangeText={setNewName} autoFocus />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => { setShowCreate(false); setNewName('') }} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} style={styles.modalConfirm}>
                <Text style={styles.modalConfirmText}>创建</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editPl} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>编辑歌单</Text>
            <TextInput style={styles.modalInput} placeholder="歌单名称" value={editName} onChangeText={setEditName} autoFocus />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setEditPl(null)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleEdit} style={styles.modalConfirm}>
                <Text style={styles.modalConfirmText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  createBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 6 },
  createText: { fontSize: 15, color: '#EC4141' },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  cover: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#EC4141', justifyContent: 'center', alignItems: 'center' },
  favCover: { backgroundColor: '#ef4444' },
  coverText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, color: '#1e293b', fontWeight: '500' },
  count: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  delBtn: { padding: 8 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '80%', maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 16 },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalCancel: { paddingHorizontal: 16, paddingVertical: 8 },
  modalCancelText: { color: '#64748b', fontSize: 15 },
  modalConfirm: { backgroundColor: '#EC4141', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  modalConfirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
