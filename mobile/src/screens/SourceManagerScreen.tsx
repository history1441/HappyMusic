import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Switch, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { loadSourcesFromBackend, getSelectedSources, saveSelectedSources, type SourceInfo } from '../services/sourceService'

export default function SourceManagerScreen() {
  const navigation = useNavigation<any>()
  const insets = useSafeAreaInsets()
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const available = await loadSourcesFromBackend()
      const saved = await getSelectedSources()
      setSources(available)
      setSelected(new Set(saved.length > 0 ? saved : available.map(s => s.id)))
      setLoading(false)
    })()
  }, [])

  const toggleSource = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    const ids = Array.from(selected)
    await saveSelectedSources(ids)
    navigation.goBack()
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>音乐源管理</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#EC4141" />
        </View>
      ) : (
        <>
          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 80 }}>
            <Text style={styles.hint}>选择搜索时使用的音乐源，仅显示服务端已启用的源</Text>
            {sources.map(src => (
              <View key={src.id} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Ionicons name="musical-note-outline" size={20} color="#EC4141" />
                  <Text style={styles.rowLabel}>{src.name}</Text>
                </View>
                <Switch
                  value={selected.has(src.id)}
                  onValueChange={() => toggleSource(src.id)}
                  trackColor={{ false: '#e2e8f0', true: '#EC4141' }}
                  thumbColor="#fff"
                />
              </View>
            ))}
            {sources.length === 0 && (
              <View style={styles.center}>
                <Text style={styles.emptyText}>暂无可用音乐源</Text>
                <Text style={styles.emptyHint}>请检查服务器配置</Text>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Text style={styles.footerText}>已选择 {selected.size} / {sources.length} 个源</Text>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>保存</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginHorizontal: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },
  hint: { fontSize: 12, color: '#94a3b8', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontSize: 15, color: '#333' },
  emptyText: { fontSize: 16, color: '#94a3b8' },
  emptyHint: { fontSize: 13, color: '#cbd5e1', marginTop: 4 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  footerText: { fontSize: 13, color: '#64748b' },
  saveBtn: {
    paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#EC4141',
    borderRadius: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
