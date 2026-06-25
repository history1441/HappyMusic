import React, { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { useHeaderPadding } from '../hooks/useHeaderPadding'
import { useTheme } from '../hooks/useTheme'

interface LoginRecord {
  id: number
  action: string
  success: boolean
  ip_address: string
  user_agent: string
  created_at: string
}

interface ParsedUA {
  os: string
  device: string
  browser: string
}

function parseUA(ua: string): ParsedUA {
  let os = '未知系统'
  let device = '未知设备'
  let browser = '未知浏览器'

  if (!ua) return { os, device, browser }

  // OS detection
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s([\d.]+)/)
    os = match ? `Android ${match[1]}` : 'Android'
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const match = ua.match(/OS\s([\d_]+)/)
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS'
  } else if (/Windows/i.test(ua)) {
    os = 'Windows'
  } else if (/Mac OS X/i.test(ua)) {
    os = 'macOS'
  } else if (/Linux/i.test(ua)) {
    os = 'Linux'
  }

  // Device detection
  if (/Expo/i.test(ua)) {
    device = 'Expo Go'
  } else if (/iPhone/i.test(ua)) {
    device = 'iPhone'
  } else if (/iPad/i.test(ua)) {
    device = 'iPad'
  } else if (/Android/i.test(ua)) {
    device = 'Android 手机'
  } else if (/Windows/i.test(ua)) {
    device = 'PC'
  } else if (/Mac/i.test(ua)) {
    device = 'Mac'
  }

  // Browser detection
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) {
    browser = 'Chrome'
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari'
  } else if (/Firefox/i.test(ua)) {
    browser = 'Firefox'
  } else if (/Edge/i.test(ua)) {
    browser = 'Edge'
  } else if (/Expo/i.test(ua)) {
    browser = 'Expo'
  }

  return { os, device, browser }
}

function getActionLabel(action: string): string {
  switch (action) {
    case 'password_login':
    case 'login':
      return '密码登录'
    case 'qrcode_login':
    case 'scan_login':
      return '扫码登录'
    case 'qrcode_confirm':
    case 'scan_confirm':
      return '扫码确认'
    case 'token_refresh':
      return '令牌刷新'
    case 'register':
      return '注册'
    default:
      return action || '登录'
  }
}

function formatTimestamp(ts: string): string {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

export default function LoginHistoryScreen() {
  const navigation = useNavigation()
  const [records, setRecords] = useState<LoginRecord[]>([])
  const [loading, setLoading] = useState(true)
  const headerPad = useHeaderPadding()
  const { colors } = useTheme()

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const { data } = await api.get('/auth/login-history')
      setRecords(data?.logs || [])
    } catch (e) {
      console.error('Failed to load login history:', e)
    } finally {
      setLoading(false)
    }
  }

  const renderItem = ({ item }: { item: LoginRecord }) => {
    const ua = parseUA(item.user_agent)
    return (
      <View style={[styles.recordRow, { backgroundColor: colors.card, borderBottomColor: colors.background }]}>
        <View style={styles.iconSection}>
          {item.success ? (
            <View style={[styles.successIcon, { backgroundColor: colors.success }]}>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
          ) : (
            <View style={[styles.failIcon, { backgroundColor: colors.danger }]}>
              <Ionicons name="close" size={14} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.recordContent}>
          <View style={styles.recordTop}>
            <View style={[
              styles.actionBadge,
              item.success ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fef2f2' },
            ]}>
              <Text style={[
                styles.actionBadgeText,
                item.success ? { color: '#16a34a' } : { color: '#dc2626' },
              ]}>
                {getActionLabel(item.action)}
              </Text>
            </View>
            <Text style={[styles.timeText, { color: colors.textTertiary }]}>{formatTimestamp(item.created_at)}</Text>
          </View>

          <View style={styles.recordDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
              <Text style={[styles.detailText, { color: colors.textTertiary }]}>IP: {item.ip_address || '未知'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="phone-portrait-outline" size={12} color={colors.textTertiary} />
              <Text style={[styles.detailText, { color: colors.textTertiary }]}>{ua.os} · {ua.device} · {ua.browser}</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: headerPad, backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>登录历史</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          removeClippedSubviews={true}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={5}
          contentContainerStyle={records.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无登录记录</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  recordRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconSection: {
    marginRight: 12,
    justifyContent: 'center',
  },
  successIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  failIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordContent: {
    flex: 1,
  },
  recordTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 12,
  },
  recordDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
  },
})
