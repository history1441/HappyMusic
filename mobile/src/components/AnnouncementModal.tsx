import React from 'react'
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { Announcement } from '../services/announcementService'
import { useTheme } from '../hooks/useTheme'

interface Props {
  visible: boolean
  announcements: Announcement[]
  onClose: () => void
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  info: { icon: 'ℹ', color: '#3b82f6', bg: '#3b82f615', label: '通知' },
  warning: { icon: '⚠', color: '#f59e0b', bg: '#f59e0b15', label: '警告' },
  update: { icon: '🔄', color: '#EC4141', bg: '#EC414115', label: '更新' },
}

export default function AnnouncementModal({ visible, announcements, onClose }: Props) {
  const { colors } = useTheme()

  if (!announcements.length) return null

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.title, { color: colors.text }]}>系统公告</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: colors.textTertiary }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {announcements.map(a => {
              const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.info
              return (
                <View key={a.id} style={[styles.item, { backgroundColor: colors.background, borderLeftColor: cfg.color }]}>
                  <View style={styles.itemHeader}>
                    <Text style={[styles.typeBadge, { backgroundColor: cfg.bg, color: cfg.color }]}>
                      {cfg.icon} {cfg.label}
                    </Text>
                    {a.is_pinned && <Text style={styles.pinBadge}>📌 置顶</Text>}
                  </View>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{a.title}</Text>
                  <Text style={[styles.itemContent, { color: colors.textSecondary }]}>{a.content}</Text>
                  <Text style={[styles.itemTime, { color: colors.textTertiary }]}>{new Date(a.created_at).toLocaleString('zh-CN')}</Text>
                </View>
              )
            })}
          </ScrollView>
          <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={styles.confirmText}>知道了</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 20 },
  card: { borderRadius: 16, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: '700' },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 16 },
  list: { padding: 16 },
  item: { padding: 14, marginBottom: 12, borderRadius: 10, borderLeftWidth: 3 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  typeBadge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  pinBadge: { fontSize: 11, color: '#f59e0b' },
  itemTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  itemContent: { fontSize: 13, lineHeight: 20 },
  itemTime: { fontSize: 11, marginTop: 8 },
  confirmBtn: { margin: 16, marginTop: 0, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
