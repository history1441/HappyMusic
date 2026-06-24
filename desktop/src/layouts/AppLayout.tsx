import { Outlet } from 'react-router'
import { useLocation, useNavigate } from 'react-router'
import { useState, useEffect } from 'react'
import { useDesktopSync } from '../hooks/useDesktopSync'
import {
  Home, Search, Disc3, Library, Settings,
  Download, FolderOpen, BarChart3,
  Flame, Radio, Sparkles, Gamepad2,
  Clock, Heart, Scissors, Server, History,
  HardDrive, Bell,
} from 'lucide-react'
import MiniPlayer from '../components/MiniPlayer'
import { cn } from '../utils/cn'
import { fetchAnnouncements, setLastSeenId, getLastSeenId, type Announcement } from '../services/announcementService'

const navItems = [
  { path: '/home', label: '发现', icon: Home },
  { path: '/search', label: '搜索', icon: Search },
  { path: '/player', label: '播放', icon: Disc3 },
  { path: '/playlists', label: '歌单', icon: Library },
  { divider: true, label: '音乐服务' },
  { path: '/downloads', label: '下载管理', icon: Download },
  { path: '/local', label: '本地音乐', icon: FolderOpen },
  { path: '/storage', label: '存储空间', icon: HardDrive },
  { divider: true, label: '发现' },
  { path: '/hot-charts', label: '热门排行', icon: Flame },
  { path: '/mood-radio', label: '心情电台', icon: Radio },
  { path: '/ai-recommend', label: 'AI 推荐', icon: Sparkles },
  { path: '/guess-game', label: '猜歌游戏', icon: Gamepad2 },
  { divider: true, label: '数据' },
  { path: '/stats', label: '听歌统计', icon: BarChart3 },
  { path: '/recent', label: '最近播放', icon: Clock },
  { path: '/favorites', label: '我的收藏', icon: Heart },
  { divider: true, label: '工具' },
  { path: '/ringtone', label: '铃声制作', icon: Scissors },
  { path: '/sources', label: '音源管理', icon: Server },
  { path: '/login-history', label: '登录记录', icon: History },
  { path: '/settings', label: '设置', icon: Settings },
]

export default function AppLayout() {
  // Initialize WebSocket sync
  useDesktopSync()

  const location = useLocation()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>([])
  const [showAnnouncements, setShowAnnouncements] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        const items = await fetchAnnouncements()
        const lastId = await getLastSeenId()
        const unread = items.filter(a => a.id > lastId)
        setUnreadCount(unread.length)
        setAllAnnouncements(items)
        if (unread.length > 0) setShowAnnouncements(true)
      } catch {}
    }
    check()
  }, [])

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-border">
          <span className="text-lg font-bold text-primary">HappyMusic</span>
          <span className="ml-2 text-xs text-text-tertiary">Desktop</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowAnnouncements(true)} className="relative p-1.5 rounded-lg hover:bg-border-light transition-colors">
              <Bell size={18} className="text-text-secondary" />
              {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {navItems.map((item, i) => {
            if ('divider' in item && item.divider) {
              return (
                <div key={`d-${i}`} className="px-3 py-2 mt-2">
                  <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                    {item.label}
                  </span>
                </div>
              )
            }
            const Icon = item.icon!
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path!)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-primary-light text-primary font-medium'
                    : 'text-text-secondary hover:bg-border-light hover:text-text'
                )}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>

        {/* Mini player bar */}
        <MiniPlayer />
      </main>

      {/* 公告弹窗 */}
      {showAnnouncements && allAnnouncements.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAnnouncements(false)}>
          <div className="bg-card rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-base font-bold text-text">系统公告</h3>
              <button onClick={() => setShowAnnouncements(false)} className="text-text-tertiary hover:text-text">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {allAnnouncements.map(a => {
                const colors: Record<string, string> = { info: 'border-blue-400 bg-blue-50', warning: 'border-yellow-400 bg-yellow-50', update: 'border-red-400 bg-red-50' }
                const badges: Record<string, string> = { info: 'ℹ 通知', warning: '⚠ 警告', update: '🔄 更新' }
                return (
                  <div key={a.id} className={`p-3 rounded-lg border-l-[3px] ${colors[a.type] || colors.info}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">{badges[a.type] || badges.info}</span>
                      {a.is_pinned && <span className="text-xs text-yellow-600">📌 置顶</span>}
                    </div>
                    <div className="text-sm font-medium text-text mb-1">{a.title}</div>
                    <div className="text-xs text-text-secondary">{a.content}</div>
                    <div className="text-[11px] text-text-tertiary mt-2">{new Date(a.created_at).toLocaleString('zh-CN')}</div>
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-3 border-t border-border">
              <button onClick={async () => { if (allAnnouncements.length) await setLastSeenId(Math.max(...allAnnouncements.map(a => a.id))); setUnreadCount(0); setShowAnnouncements(false) }} className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium">知道了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
