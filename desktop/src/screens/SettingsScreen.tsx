import { useState } from 'react'
import { useNavigate } from 'react-router'
import api, {
  getApiUrl,
  saveApiUrl,
  getCachedUser,
  clearTokenCache,
} from '@common/services/api'
import { showToast } from '../components/Toast'
import { cn } from '../utils/cn'
import {
  Heart,
  Clock,
  Download,
  Music,
  Gamepad2,
  Radio,
  Sparkles,
  BarChart3,
  Scissors,
  QrCode,
  FileUp,
  Moon,
  KeyRound,
  Server,
  Trash2,
  HardDrive,
  History,
  ChevronRight,
  LogOut,
  RefreshCw,
  X,
  Loader2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Icon map for menu items
// ---------------------------------------------------------------------------
const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  heart: Heart,
  'time-outline': Clock,
  'download-outline': Download,
  'musical-notes-outline': Music,
  'game-controller-outline': Gamepad2,
  'radio-outline': Radio,
  sparkles: Sparkles,
  'bar-chart-outline': BarChart3,
  'cut-outline': Scissors,
  'qr-code-outline': QrCode,
  'document-attach-outline': FileUp,
  'moon-outline': Moon,
  'key-outline': KeyRound,
  'server-outline': Server,
  'musical-note-outline': Music,
  'list-outline': History,
  'trash-outline': Trash2,
  'folder-outline': HardDrive,
}

// ---------------------------------------------------------------------------
// Dark mode helpers (pure DOM + localStorage, no store needed yet)
// ---------------------------------------------------------------------------
function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark')
}

function toggleDarkMode() {
  document.documentElement.classList.toggle('dark')
  localStorage.setItem('theme', isDarkMode() ? 'dark' : 'light')
}

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------
declare const __APP_VERSION__: string
const APP_VERSION = __APP_VERSION__

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SettingsScreen() {
  const navigate = useNavigate()
  const user = getCachedUser()
  const [dark, setDark] = useState(isDarkMode())

  const [showChangePwd, setShowChangePwd] = useState(false)
  const [changePwdLoading, setChangePwdLoading] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')

  const [showApiConfig, setShowApiConfig] = useState(false)
  const [apiUrlInput, setApiUrlInput] = useState(getApiUrl())
  const [apiChecking, setApiChecking] = useState(false)

  // ---- actions ----

  const handleLogout = () => {
    if (!window.confirm('确定要退出登录吗？')) return
    clearTokenCache()
    navigate('/login', { replace: true })
  }

  const handleCleanup = async () => {
    // Desktop: clear expired localStorage keys related to cache
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('cache_')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
    showToast(`已清理 ${keysToRemove.length} 条缓存`, 'success')
  }

  const handleCheckUpdate = async () => {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(`${getApiUrl()}/api/app/releases/latest?platform=desktop`, {
        signal: controller.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data.version) {
        const va = APP_VERSION.split('.').map(Number)
        const vb = (data.version as string).split('.').map(Number)
        let isNewer = false
        for (let i = 0; i < Math.max(va.length, vb.length); i++) {
          if ((vb[i] || 0) > (va[i] || 0)) { isNewer = true; break }
          if ((vb[i] || 0) < (va[i] || 0)) break
        }
        if (isNewer) {
          if (window.confirm(`发现新版本 v${data.version}\n\n${data.changelog || ''}\n\n是否立即下载？`)) {
            window.open(`${getApiUrl()}/api/app/releases/download/${data.filename}`, '_blank')
          }
        } else {
          showToast(`已是最新版本 v${APP_VERSION}`, 'success')
        }
      } else {
        showToast(`已是最新版本 v${APP_VERSION}`, 'success')
      }
    } catch {
      showToast('检查更新失败，无法连接到服务器', 'error')
    }
  }

  const handleChangePassword = async () => {
    if (!oldPwd || !newPwd) {
      showToast('请填写旧密码和新密码', 'error')
      return
    }
    setChangePwdLoading(true)
    try {
      await api.post('/auth/change-password', { old_password: oldPwd, new_password: newPwd })
      showToast('密码修改成功', 'success')
      setShowChangePwd(false)
      setOldPwd('')
      setNewPwd('')
    } catch (err: any) {
      showToast(err.response?.data?.detail || '密码修改失败', 'error')
    } finally {
      setChangePwdLoading(false)
    }
  }

  const handleToggleDark = () => {
    toggleDarkMode()
    setDark(isDarkMode())
  }

  // ---- menu data ----

  const musicServiceItems = [
    { icon: 'heart', label: '我喜欢的', route: '/favorites' },
    { icon: 'time-outline', label: '最近播放', route: '/recent' },
    { icon: 'download-outline', label: '下载管理', route: '/downloads' },
    { icon: 'musical-notes-outline', label: '本地音乐', route: '/local' },
  ]

  const discoverItems = [
    { icon: 'game-controller-outline', label: '猜歌游戏', route: '/guess-game' },
    { icon: 'radio-outline', label: '心情电台', route: '/mood-radio' },
    { icon: 'sparkles', label: 'AI推荐', route: '/ai-recommend' },
    { icon: 'bar-chart-outline', label: '听歌统计', route: '/stats' },
  ]

  type SettingAction = 'toggleTheme' | 'changePwd' | 'apiConfig' | 'cleanup'
  const toolSettingsItems: { icon: string; label: string; route?: string; action?: SettingAction }[] = [
    { icon: 'cut-outline', label: '铃声制作', route: '/ringtone' },
    { icon: 'document-attach-outline', label: '本地导入', route: '/local/import' },
    { icon: 'moon-outline', label: dark ? '浅色模式' : '深色模式', action: 'toggleTheme' },
    { icon: 'key-outline', label: '修改密码', action: 'changePwd' },
    { icon: 'server-outline', label: '服务器地址', action: 'apiConfig' },
    { icon: 'musical-note-outline', label: '音乐源管理', route: '/sources' },
    { icon: 'list-outline', label: '登录历史', route: '/login-history' },
    { icon: 'trash-outline', label: '清理缓存', action: 'cleanup' },
    { icon: 'folder-outline', label: '存储管理', route: '/storage' },
  ]

  const handleItemPress = (item: { action?: string; route?: string }) => {
    switch (item.action) {
      case 'toggleTheme': handleToggleDark(); break
      case 'changePwd': setShowChangePwd(true); break
      case 'cleanup': handleCleanup(); break
      case 'apiConfig':
        setApiUrlInput(getApiUrl())
        setShowApiConfig(true)
        break
      default:
        if (item.route) navigate(item.route)
    }
  }

  // ---- render helpers ----

  const renderGridItem = (item: { icon: string; label: string; route?: string; action?: string }) => {
    const Icon = iconMap[item.icon] ?? Music
    return (
      <button
        key={item.label}
        onClick={() => handleItemPress(item)}
        className="flex flex-col items-center justify-center p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all"
      >
        <Icon size={26} className="text-primary mb-2" />
        <span className="text-sm">{item.label}</span>
      </button>
    )
  }

  const renderListItem = (
    item: { icon: string; label: string; route?: string; action?: string },
    isLast: boolean,
  ) => {
    const Icon = iconMap[item.icon] ?? Music
    return (
      <button
        key={item.label}
        onClick={() => handleItemPress(item)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-border-light',
          !isLast && 'border-b border-border-light',
        )}
      >
        <Icon size={18} className="text-primary flex-shrink-0" />
        <span className="flex-1 text-sm">{item.label}</span>
        {item.action === 'toggleTheme' ? (
          <ToggleSwitch checked={dark} onChange={handleToggleDark} />
        ) : (
          <ChevronRight size={16} className="text-text-tertiary" />
        )}
      </button>
    )
  }

  // ---- main render ----

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Profile header */}
      <div className="bg-gradient-to-r from-primary to-red-500 rounded-2xl p-6 text-white mb-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center overflow-hidden flex-shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-white">
                {user?.nickname?.[0] || user?.username?.[0]?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">
              {user?.nickname || user?.username || '未登录'}
            </h2>
            {user?.username && user?.nickname && user.nickname !== user.username && (
              <p className="text-white/75 text-sm mt-0.5">@{user.username}</p>
            )}
          </div>
        </div>
      </div>

      {/* Music services grid */}
      <SectionTitle label="音乐服务" />
      <div className="grid grid-cols-4 gap-3 mb-6">
        {musicServiceItems.map(renderGridItem)}
      </div>

      {/* Discover grid */}
      <SectionTitle label="发现更多" />
      <div className="grid grid-cols-4 gap-3 mb-6">
        {discoverItems.map(renderGridItem)}
      </div>

      {/* Tools & settings list */}
      <SectionTitle label="工具与设置" />
      <div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
        {toolSettingsItems.map((item, i) => renderListItem(item, i === toolSettingsItems.length - 1))}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 rounded-xl border border-red-200 text-danger text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors mb-4"
      >
        <span className="inline-flex items-center gap-2">
          <LogOut size={16} />
          退出登录
        </span>
      </button>

      {/* Version */}
      <div className="text-center space-y-1 pb-8">
        <p className="text-xs text-text-tertiary">v{APP_VERSION}</p>
        <button
          onClick={handleCheckUpdate}
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          <RefreshCw size={14} />
          检查更新
        </button>
      </div>

      {/* ---------- Change Password Modal ---------- */}
      {showChangePwd && (
        <ModalOverlay onClose={() => setShowChangePwd(false)}>
          <h3 className="text-lg font-semibold mb-4">修改密码</h3>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="旧密码"
              value={oldPwd}
              onChange={e => setOldPwd(e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-bg text-sm focus:outline-none focus:border-primary transition-colors"
            />
            <input
              type="password"
              placeholder="新密码"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-bg text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setShowChangePwd(false)}
              className="flex-1 py-2.5 rounded-lg bg-border-light text-text-secondary text-sm font-medium hover:bg-border transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleChangePassword}
              disabled={changePwdLoading}
              className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              {changePwdLoading && <Loader2 size={14} className="animate-spin" />}
              {changePwdLoading ? '提交中...' : '确认修改'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ---------- API URL Modal ---------- */}
      {showApiConfig && (
        <ModalOverlay onClose={() => setShowApiConfig(false)}>
          <h3 className="text-lg font-semibold mb-2">服务器地址配置</h3>
          <p className="text-xs text-text-secondary mb-4">
            当前地址: <span className="font-mono">{getApiUrl()}</span>
          </p>
          <input
            type="url"
            placeholder="http://192.168.x.x:8190"
            value={apiUrlInput}
            onChange={e => setApiUrlInput(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-lg bg-bg text-sm font-mono focus:outline-none focus:border-primary transition-colors"
          />
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setShowApiConfig(false)}
              className="flex-1 py-2.5 rounded-lg bg-border-light text-text-secondary text-sm font-medium hover:bg-border transition-colors"
            >
              取消
            </button>
            <button
              onClick={async () => {
                setApiChecking(true)
                try {
                  const ok = await checkReachable(apiUrlInput)
                  if (ok) {
                    await saveApiUrl(apiUrlInput)
                    showToast('服务器地址已更新', 'success')
                    setShowApiConfig(false)
                  } else {
                    showToast('无法连接到该地址', 'error')
                  }
                } catch {
                  showToast('连接测试失败', 'error')
                } finally {
                  setApiChecking(false)
                }
              }}
              disabled={apiChecking}
              className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              {apiChecking && <Loader2 size={14} className="animate-spin" />}
              {apiChecking ? '测试中...' : '保存'}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ label }: { label: string }) {
  return (
    <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
      {label}
    </h3>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
        checked ? 'bg-primary' : 'bg-border',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="relative bg-card rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-text-tertiary hover:text-text transition-colors"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function checkReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${url.trim().replace(/\/+$/, '')}/api/auth/ping`, {
      signal: controller.signal,
    })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}
