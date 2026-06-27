import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, TextInput, Modal, Linking, Image, Switch } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore, type ThemeMode } from '../stores/themeStore'
import { useTheme } from '../hooks/useTheme'
import { cleanupExpiredCache } from '../services/storageService'
import * as FileSystem from 'expo-file-system/legacy'
import { getApiUrl, saveApiUrl, checkBackendReachable, APP_VERSION } from '../utils/constants'
import { useCacheLimitStore } from '../stores/cacheLimitStore'
import { useComfortStore, TTS_VOICES } from '../stores/comfortStore'
import api from '../services/api'
import ChangePasswordModal from '../components/ChangePasswordModal'

export default function SettingsScreen() {
  const navigation = useNavigation<any>()
  const { user, logout } = useAuthStore()
  const { mode: themeMode, setMode: setThemeMode } = useThemeStore()
  const { colors, isDark } = useTheme()
  const { maxMB, setLimit } = useCacheLimitStore()
  const { enabled: comfortEnabled, setEnabled: setComfortEnabled, voice: comfortVoice, setVoice: setComfortVoice } = useComfortStore()
  const insets = useSafeAreaInsets()
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [showApiConfig, setShowApiConfig] = useState(false)
  const [apiUrlInput, setApiUrlInput] = useState(getApiUrl())
  const [apiChecking, setApiChecking] = useState(false)
  const [showCacheLimit, setShowCacheLimit] = useState(false)
  const [showVoicePicker, setShowVoicePicker] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [freeSpaceMB, setFreeSpaceMB] = useState(10000) // 默认 10GB
  const [cacheInputGB, setCacheInputGB] = useState(maxMB === 0 ? '' : String(maxMB / 1000))

  // 获取磁盘剩余空间
  const getFreeSpace = async () => {
    try {
      const info = await FileSystem.getFreeDiskStorageAsync()
      setFreeSpaceMB(Math.floor(info / (1024 * 1024)))
    } catch {}
  }

  // 打开缓存限制弹窗时获取空间
  const openCacheLimitModal = () => {
    getFreeSpace()
    setCacheInputGB(maxMB === 0 ? '' : String(maxMB / 1000))
    setShowCacheLimit(true)
  }

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: logout },
    ])
  }

  const handleCleanup = async () => {
    const count = await cleanupExpiredCache()
    Alert.alert('清理完成', `已清理 ${count} 首过期缓存`)
  }

  const handleCheckUpdate = async () => {
    try {
      const { data } = await api.get('/app/releases/latest', { params: { platform: 'android' }, timeout: 8000 })
      if (data.version) {
        const va = APP_VERSION.split('.').map(Number)
        const vb = data.version.split('.').map(Number)
        let isNewer = false
        for (let i = 0; i < Math.max(va.length, vb.length); i++) {
          if ((vb[i] || 0) > (va[i] || 0)) { isNewer = true; break }
          if ((vb[i] || 0) < (va[i] || 0)) break
        }
        if (isNewer) {
          Alert.alert('发现新版本', `当前: v${APP_VERSION} → 最新: v${data.version}\n\n${data.changelog || ''}`, [
            { text: '稍后再说', style: 'cancel' },
            { text: '立即下载', onPress: () => Linking.openURL(`${getApiUrl()}/api/app/releases/download/${data.filename}`) },
          ])
        } else {
          Alert.alert('已是最新版本', `当前: v${APP_VERSION}`)
        }
      } else {
        Alert.alert('已是最新版本', `当前: v${APP_VERSION}`)
      }
    } catch {
      Alert.alert('检查失败', '无法连接到服务器')
    }
  }

  // 音乐服务 - 2x2 网格(发现类功能已统一在 Home 发现页,避免与 Settings 重复)
  const musicServiceItems = [
    { icon: 'heart', label: '我喜欢的', action: 'favorites' },
    { icon: 'time-outline', label: '最近播放', route: 'RecentPlays' },
    { icon: 'download-outline', label: '下载管理', route: 'DownloadManager' },
    { icon: 'musical-notes-outline', label: '本地音乐', route: 'LocalLibrary' },
  ]

  const currentLimitLabel = maxMB === 0 ? '不限制' : maxMB >= 1000 ? `${maxMB / 1000} GB` : `${maxMB} MB`

  // 工具与设置 - 列表样式
  const toolSettingsItems = [
    { icon: 'cut-outline', label: '铃声制作', route: 'RingtoneMaker' },
    { icon: 'qr-code-outline', label: '扫一扫', route: 'ScanQR' },
    { icon: 'document-attach-outline', label: '本地导入', route: 'LocalFileImport' },
    { icon: 'moon-outline', label: '外观主题', action: 'themeMode' },
    { icon: 'key-outline', label: '修改密码', action: 'changePwd' },
    { icon: 'server-outline', label: '服务器地址', action: 'apiConfig' },
    { icon: 'musical-note-outline', label: '音乐源管理', route: 'SourceManager' },
    { icon: 'pie-chart-outline', label: `缓存限制 · ${currentLimitLabel}`, action: 'cacheLimit' },
    { icon: 'mic-outline', label: 'AI语音关怀', action: 'comfortToggle' },
    { icon: 'volume-high-outline', label: '语音音色', action: 'voicePicker' },
    { icon: 'list-outline', label: '登录历史', route: 'LoginHistory' },
    { icon: 'trash-outline', label: '清理缓存', action: 'cleanup' },
    { icon: 'folder-outline', label: '存储管理', route: 'Storage' },
  ]

  const handleItemPress = (item: { action?: string; route?: string }) => {
    if (item.action === 'changePwd') setShowChangePwd(true)
    else if (item.action === 'themeMode') setShowThemePicker(true)
    else if (item.action === 'cleanup') handleCleanup()
    else if (item.action === 'apiConfig') {
      setApiUrlInput(getApiUrl())
      setShowApiConfig(true)
    }
    else if (item.action === 'cacheLimit') openCacheLimitModal()
    else if (item.action === 'favorites') {
      api.get('/playlists').then(({ data }) => {
        const playlists = data.playlists || data || []
        const fav = playlists.find((p: any) => p.is_favorite)
        if (fav) {
          navigation.navigate('Playlists', { screen: 'PlaylistDetail', params: { playlistId: fav.id, name: '我喜欢的' } })
        } else {
          navigation.navigate('Favorites')
        }
      }).catch(() => navigation.navigate('Favorites'))
    }
    else if (item.action === 'comfortToggle') setComfortEnabled(!comfortEnabled)
    else if (item.action === 'voicePicker') setShowVoicePicker(true)
    else if (item.route) navigation.navigate(item.route)
  }

  const renderGridItem = (item: { icon: string; label: string; route?: string; action?: string }, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.gridItem}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.6}
    >
      <Ionicons name={item.icon as any} size={28} color={colors.primary} />
      <Text style={[styles.gridLabel, { color: colors.text }]}>{item.label}</Text>
    </TouchableOpacity>
  )

  const renderListItem = (item: { icon: string; label: string; route?: string; action?: string }, index: number, total: number) => (
    <TouchableOpacity
      key={index}
      style={[styles.listItem, index < total - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight }]}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.6}
    >
      <Ionicons name={item.icon as any} size={20} color={colors.primary} />
      <Text style={[styles.listLabel, { color: colors.text }]}>{item.label}</Text>
      {item.action === 'themeMode' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 13, color: colors.textTertiary }}>
            {themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '深色' : '浅色'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </View>
      ) : item.action === 'comfortToggle' ? (
        <Switch
          value={comfortEnabled}
          onValueChange={setComfortEnabled}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.card}
        />
      ) : item.action === 'voicePicker' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 13, color: colors.textTertiary }}>
            {TTS_VOICES.find(v => v.id === comfortVoice)?.name || '晓晓'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  )

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: insets.top }}>
      {/* 头部区域 - 红色渐变背景 */}
      <View style={styles.headerBg}>
        <View style={styles.headerContent}>
          <View style={styles.avatar}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{user?.nickname?.[0] || user?.username?.[0]?.toUpperCase() || '?'}</Text>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.nickname}>{user?.nickname || user?.username || '未登录'}</Text>
            {user?.username && user?.nickname && user.nickname !== user.username && (
              <Text style={styles.subtitle}>@{user.username}</Text>
            )}
          </View>
        </View>
      </View>

      {/* 卡片内容区域 - 覆盖在头部底部 */}
      <View style={[styles.contentCard, { backgroundColor: colors.card }]}>
        {/* 音乐服务 */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>音乐服务</Text>
        <View style={styles.gridRow}>
          {musicServiceItems.slice(0, 2).map((item, i) => renderGridItem(item, i))}
        </View>
        <View style={styles.gridRow}>
          {musicServiceItems.slice(2, 4).map((item, i) => renderGridItem(item, i + 2))}
        </View>

        {/* 工具与设置 */}
        <Text style={[styles.sectionTitle, { marginTop: 8, color: colors.textSecondary }]}>工具与设置</Text>
        <View style={[styles.listSection, { backgroundColor: colors.card, borderTopColor: colors.borderLight, borderBottomColor: colors.borderLight }]}>
          {toolSettingsItems.map((item, i) => renderListItem(item, i, toolSettingsItems.length))}
        </View>

        {/* 退出按钮 */}
        <TouchableOpacity style={[styles.logoutBtn, { borderColor: colors.primaryLight }]} onPress={handleLogout}>
          <Text style={[styles.logoutText, { color: colors.danger }]}>退出登录</Text>
        </TouchableOpacity>

        {/* 版本信息 */}
        <View style={styles.versionArea}>
          <Text style={[styles.versionText, { color: colors.textTertiary }]}>v{APP_VERSION}</Text>
          <TouchableOpacity onPress={handleCheckUpdate}>
            <Text style={[styles.updateText, { color: colors.primary }]}>检查更新</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 40 }} />

      <ChangePasswordModal visible={showChangePwd} onClose={() => setShowChangePwd(false)} />

      <Modal visible={showApiConfig} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: '600', marginBottom: 12, color: colors.text }}>服务器地址配置</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>当前: {getApiUrl()}</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, height: 44, fontSize: 15, color: colors.text }}
              value={apiUrlInput}
              onChangeText={setApiUrlInput}
              placeholder="http://192.168.x.x:8190"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: colors.borderLight }}
                onPress={() => setShowApiConfig(false)}
              >
                <Text style={{ color: colors.textSecondary }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary, opacity: apiChecking ? 0.6 : 1 }}
                onPress={async () => {
                  setApiChecking(true)
                  // Normalize URL: remove trailing slash, ensure no double /api
                  const normalized = apiUrlInput.trim().replace(/\/+$/, '')
                  const ok = await checkBackendReachable(normalized)
                  if (ok) {
                    await saveApiUrl(normalized)
                    setApiUrlInput(normalized) // Sync input with saved URL
                    Alert.alert('成功', '服务器地址已更新', [{ text: '确定', onPress: () => { setShowApiConfig(false) } }])
                  } else {
                    Alert.alert('连接失败', '无法连接到该地址')
                  }
                  setApiChecking(false)
                }}
                disabled={apiChecking}
              >
                <Text style={{ color: colors.card, fontWeight: '600' }}>{apiChecking ? '测试中...' : '保存'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 缓存限制选择弹窗 - 输入框模式 */}
      <Modal visible={showCacheLimit} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: '600', marginBottom: 4, color: colors.text }}>缓存大小限制</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>超出限制时自动清理最早且未播放的缓存</Text>

            <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 8 }}>
              系统剩余空间: {freeSpaceMB >= 1000 ? `${(freeSpaceMB / 1000).toFixed(1)} GB` : `${freeSpaceMB} MB`}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <TextInput
                style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, height: 44, fontSize: 16, color: colors.text }}
                value={cacheInputGB}
                onChangeText={setCacheInputGB}
                placeholder="输入 GB 数，留空或 0 表示不限制"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={{ fontSize: 16, color: colors.text, fontWeight: '600' }}>GB</Text>
            </View>

            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              当前设置: {maxMB === 0 ? '不限制' : `${maxMB / 1000} GB`}
            </Text>

            {/* 确认按钮 */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                style={{ flex: 1, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: colors.borderLight }}
                onPress={() => setShowCacheLimit(false)}
              >
                <Text style={{ color: colors.textSecondary }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }}
                onPress={() => {
                  const gb = parseFloat(cacheInputGB)
                  const mb = isNaN(gb) || gb <= 0 ? 0 : Math.round(gb * 1000)
                  setLimit(mb)
                  setShowCacheLimit(false)
                }}
              >
                <Text style={{ color: colors.card, fontWeight: '600' }}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 音色选择弹窗 */}
      <Modal visible={showVoicePicker} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: '600', marginBottom: 4, color: colors.text }}>选择语音音色</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>AI语音关怀使用的朗读音色</Text>

            <View style={{ gap: 4 }}>
              {TTS_VOICES.map(v => {
                const selected = comfortVoice === v.id
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      backgroundColor: selected ? colors.primaryLight : colors.background,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                    }}
                    onPress={() => {
                      setComfortVoice(v.id)
                      setShowVoicePicker(false)
                    }}
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: selected ? colors.primary : colors.border,
                      justifyContent: 'center', alignItems: 'center',
                    }}>
                      <Text style={{ fontSize: 14, color: selected ? colors.card : colors.textSecondary }}>
                        {v.gender === '女' ? '♀' : '♂'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontSize: 15, fontWeight: selected ? '600' : '400', color: selected ? colors.primary : colors.text }}>
                        {v.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{v.desc}</Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                  </TouchableOpacity>
                )
              })}
            </View>

            <TouchableOpacity
              style={{ marginTop: 16, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: colors.borderLight }}
              onPress={() => setShowVoicePicker(false)}
            >
              <Text style={{ color: colors.textSecondary }}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* 外观主题选择弹窗 */}
      <Modal visible={showThemePicker} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: '600', marginBottom: 16, color: colors.text }}>外观主题</Text>
            {([
              { mode: 'system' as ThemeMode, icon: 'phone-portrait-outline', label: '跟随系统', desc: '根据系统设置自动切换' },
              { mode: 'light' as ThemeMode, icon: 'sunny-outline', label: '浅色模式', desc: '始终使用浅色主题' },
              { mode: 'dark' as ThemeMode, icon: 'moon-outline', label: '深色模式', desc: '始终使用深色主题' },
            ]).map(opt => {
              const selected = themeMode === opt.mode
              return (
                <TouchableOpacity
                  key={opt.mode}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10,
                    backgroundColor: selected ? colors.primaryLight : colors.background,
                    borderWidth: 1, borderColor: selected ? colors.primary : colors.border,
                    marginBottom: 8,
                  }}
                  onPress={() => { setThemeMode(opt.mode); setShowThemePicker(false) }}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: selected ? colors.primary : colors.borderLight,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Ionicons name={opt.icon as any} size={18} color={selected ? '#fff' : colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: selected ? '600' : '400', color: selected ? colors.primary : colors.text }}>
                      {opt.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{opt.desc}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                </TouchableOpacity>
              )
            })}
            <TouchableOpacity
              style={{ marginTop: 8, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: colors.borderLight }}
              onPress={() => setShowThemePicker(false)}
            >
              <Text style={{ color: colors.textSecondary }}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBg: {
    backgroundColor: '#EC4141',
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  userInfo: {
    marginLeft: 14,
  },
  nickname: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  contentCard: {
    marginTop: -12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  gridItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  gridLabel: {
    fontSize: 13,
    marginTop: 6,
  },
  listSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingRight: 4,
  },
  listLabel: {
    flex: 1,
    fontSize: 15,
    marginLeft: 10,
  },
  logoutBtn: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
  },
  versionArea: {
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  versionText: {
    fontSize: 12,
  },
  updateText: {
    fontSize: 13,
  },
})
