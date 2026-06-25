import React, { useEffect, useState } from 'react'
import { StatusBar, ErrorUtils, AppState } from 'react-native'
import {
  StyleSheet, ActivityIndicator, View, Text,
  TextInput, TouchableOpacity, Alert, Modal, Linking, LogBox,
} from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeStatusBar } from './src/components/ThemeStatusBar'

LogBox.ignoreAllLogs()
import { initAdapter } from './src/adapters/mobileAdapter'
import { useAuthStore } from './src/stores/authStore'
import { setupPlayer } from './src/services/audioService'
import { cleanupExpiredCache } from './src/services/storageService'
import { loadSavedApiUrl, checkBackendReachable, saveApiUrl, getApiUrl, APP_VERSION } from './src/utils/constants'
import RootNavigator from './src/navigation/RootNavigator'
import Toast from './src/components/Toast'
import OfflineBanner from './src/components/OfflineBanner'
import { useNetworkStore } from './src/stores/networkStore'
import ErrorBoundary from './src/components/ErrorBoundary'

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0, nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

function UpdateModal({ visible, release, onClose }: { visible: boolean; release: any; onClose: () => void }) {
  if (!release) return null
  const downloadUrl = `${getApiUrl()}/api/app/releases/download/${release.filename}`
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={updStyles.overlay}>
        <View style={updStyles.card}>
          <Text style={updStyles.title}>发现新版本 v{release.version}</Text>
          {release.changelog ? (
            <Text style={updStyles.changelog}>{release.changelog}</Text>
          ) : null}
          <Text style={updStyles.current}>当前版本: v{APP_VERSION}</Text>
          <View style={updStyles.buttons}>
            <TouchableOpacity style={updStyles.laterBtn} onPress={onClose}>
              <Text style={{ color: '#64748b' }}>稍后提醒</Text>
            </TouchableOpacity>
            <TouchableOpacity style={updStyles.dlBtn} onPress={() => { Linking.openURL(downloadUrl); onClose() }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>立即下载</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const updStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  changelog: { fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 12 },
  current: { fontSize: 12, color: '#94a3b8', marginBottom: 16 },
  buttons: { flexDirection: 'row', gap: 12 },
  laterBtn: { flex: 1, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#f1f5f9' },
  dlBtn: { flex: 1, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#EC4141' },
})

function ApiConfigScreen({ onConnected }: { onConnected: () => void }) {
  const [url, setUrl] = useState(getApiUrl())
  const [checking, setChecking] = useState(false)

  const handleTest = async () => {
    const trimmed = url.trim().replace(/\/+$/, '')
    if (!trimmed) return
    setChecking(true)
    try {
      const reachable = await checkBackendReachable(trimmed)
      if (reachable) {
        await saveApiUrl(trimmed)
        Alert.alert('连接成功', '后端服务已连通', [{ text: '确定', onPress: onConnected }])
      } else {
        Alert.alert('连接失败', `无法连接到 ${trimmed}，请检查地址是否正确以及后端服务是否运行`)
      }
    } catch {
      Alert.alert('连接失败', '请检查地址格式')
    } finally {
      setChecking(false)
    }
  }

  return (
    <View style={cfgStyles.container}>
      <Text style={cfgStyles.title}>HappyMusic</Text>
      <Text style={cfgStyles.subtitle}>无法连接到后端服务</Text>
      <Text style={cfgStyles.hint}>
        当前地址: {getApiUrl()}{'\n'}
        请输入正确的后端 API 地址
      </Text>
      <TextInput
        style={cfgStyles.input}
        value={url}
        onChangeText={setUrl}
        placeholder="http://192.168.x.x:8190"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="done"
      />
      <TouchableOpacity
        style={[cfgStyles.button, checking && cfgStyles.buttonDisabled]}
        onPress={handleTest}
        disabled={checking}
      >
        <Text style={cfgStyles.buttonText}>
          {checking ? '正在连接...' : '测试连接并保存'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const cfgStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#f8fafc' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#EC4141', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#ef4444', marginBottom: 16 },
  hint: { fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  input: {
    width: '100%', height: 48, borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 16, fontSize: 15, backgroundColor: '#fff', color: '#333',
  },
  button: {
    marginTop: 20, width: '100%', height: 48, backgroundColor: '#EC4141',
    borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#fca5a5' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})

export default function App() {
  const { loadToken, isLoading } = useAuthStore()
  const [appState, setAppState] = useState<'loading' | 'config' | 'disclaimer' | 'ready'>('loading')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])

  const checkAnnouncements = async () => {
    try {
      const { getUnreadAnnouncements, setLastSeenId } = require('./src/services/announcementService')
      const unread = await getUnreadAnnouncements()
      if (unread.length > 0) {
        setAnnouncements(unread)
        await setLastSeenId(Math.max(...unread.map((a: any) => a.id)))
      }
    } catch {}
  }

  const checkForUpdate = async () => {
    try {
      const res = await Promise.race([
        fetch(`${getApiUrl()}/api/app/releases/latest?platform=android`),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ])
      const data = await res.json()
      if (data.version && compareVersions(data.version, APP_VERSION) > 0) {
        setUpdateInfo(data)
      }
    } catch {}
  }

  useEffect(() => {
    // 网络状态监听(离线检测,App 生命周期内常驻)
    useNetworkStore.getState().init()

    const init = async () => {
      ErrorUtils.setGlobalHandler((error, isFatal) => {
        console.error('Global error:', isFatal, error)
      })
      initAdapter()
      try {
        await loadSavedApiUrl()
        // 加载深色模式偏好
        try {
          const { useThemeStore } = require('./src/stores/themeStore')
          await useThemeStore.getState().init()
        } catch {}
        const reachable = await checkBackendReachable()
        if (!reachable) {
          setAppState('config')
          return
        }
        await setupPlayer()
        await loadToken()
        await cleanupExpiredCache()
        // 初始化缓存限制并执行清理
        try {
          const { useCacheLimitStore } = require('./src/stores/cacheLimitStore')
          const { enforceCacheLimit } = require('./src/services/storageService')
          await useCacheLimitStore.getState().init()
          const maxMB = useCacheLimitStore.getState().maxMB
          if (maxMB > 0) await enforceCacheLimit(maxMB)
        } catch {}
        // 初始化安慰语音设置
        try {
          const { useComfortStore } = require('./src/stores/comfortStore')
          await useComfortStore.getState().init()
        } catch {}
        // 初始化桌面歌词设置
        try {
          const { useDesktopLyricsStore } = require('./src/stores/desktopLyricsStore')
          await useDesktopLyricsStore.getState().init()
        } catch {}
        // 恢复播放状态和下载记录
        try {
          const { usePlayerStore } = require('./src/stores/playerStore')
          await usePlayerStore.getState().initializePlayer()
          const { useDownloadStore } = require('./src/stores/downloadStore')
          await useDownloadStore.getState().initialize()
        } catch {}
        // 检查免责声明
        try {
          const { useDisclaimerStore } = require('./src/stores/disclaimerStore')
          const agreed = await useDisclaimerStore.getState().checkAgreed()
          if (!agreed) { setAppState('disclaimer'); return }
        } catch {}
        setAppState('ready')
        checkForUpdate()
        checkAnnouncements()
      } catch (e) {
        console.warn('App init error:', e)
        setAppState('config')
      }
    }
    init()
  }, [])

  // 监听 App 前后台切换:后台时停掉 saveInterval 节省 IO,前台时按需恢复
  // 注意:不改变播放状态,RNTP 前台服务会保持后台播放
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const { stopPlayerInterval, resumePlayerIntervalIfActive } = require('./src/stores/playerStore')
      if (nextState === 'background' || nextState === 'inactive') {
        stopPlayerInterval()
      } else if (nextState === 'active') {
        resumePlayerIntervalIfActive()
      }
    })
    return () => sub.remove()
  }, [])

  if (appState === 'loading' || isLoading) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#EC4141" />
          <Text style={{ marginTop: 12, color: '#666' }}>正在连接服务...</Text>
        </View>
      </SafeAreaProvider>
    )
  }

  if (appState === 'config') {
    return (
      <SafeAreaProvider>
        <View style={styles.container}>
          <ThemeStatusBar />
          <ApiConfigScreen onConnected={async () => {
            setAppState('loading')
            try {
              // Reset setup flag to allow re-initialization
              const { resetPlayerSetup } = require('./src/services/audioService')
              resetPlayerSetup()
              await setupPlayer()
              await loadToken()
              await cleanupExpiredCache()
              const { usePlayerStore } = require('./src/stores/playerStore')
              await usePlayerStore.getState().initializePlayer()
              const { useDownloadStore } = require('./src/stores/downloadStore')
              await useDownloadStore.getState().initialize()
            } catch (e) {
              console.warn('Init after config:', e)
            }
            setAppState('ready')
            checkForUpdate()
          }} />
        </View>
      </SafeAreaProvider>
    )
  }

  if (appState === 'disclaimer') {
    const DisclaimerScreen = require('./src/screens/DisclaimerScreen').default
    return (
      <SafeAreaProvider>
        <View style={styles.container}>
          <ThemeStatusBar />
          <DisclaimerScreen onAgreed={() => { setAppState('ready'); checkForUpdate() }} />
        </View>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="auto" />
        <OfflineBanner />
        <ErrorBoundary>
          <RootNavigator />
        </ErrorBoundary>
        <Toast />
        <UpdateModal visible={!!updateInfo} release={updateInfo} onClose={() => setUpdateInfo(null)} />
        {announcements.length > 0 && (() => {
          const AnnouncementModal = require('./src/components/AnnouncementModal').default
          return <AnnouncementModal visible={true} announcements={announcements} onClose={() => setAnnouncements([])} />
        })()}
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
})
