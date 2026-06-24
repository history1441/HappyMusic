import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { LocalStatus } from '../types'

interface Props {
  status: LocalStatus
}

export default function CacheBadge({ status }: Props) {
  if (!status) return null

  return (
    <View style={[styles.badge, status === 'downloaded' ? styles.downloaded : styles.cached]}>
      <Text style={styles.text}>{status === 'downloaded' ? '已下载' : '已缓存'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6 },
  downloaded: { backgroundColor: '#dcfce7' },
  cached: { backgroundColor: '#fde8e8' },
  text: { fontSize: 10, fontWeight: '600' },
})
