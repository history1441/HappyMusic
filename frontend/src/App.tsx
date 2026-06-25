import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { useThemeStore } from './stores/themeStore'
import { useAdminAuthStore } from './stores/adminAuthStore'
import Layout from './components/Layout'
import AdminLayout from './components/admin/AdminLayout'

// 路由懒加载:每个页面独立 chunk,首屏只加载当前路由的代码
// 预期:首屏 JS 体积减少 60-70%,首次切换路由有微小延迟(后续访问走缓存)
const Login = lazy(() => import('./pages/Login'))
const Search = lazy(() => import('./pages/Search'))
const Playlists = lazy(() => import('./pages/Playlists'))
const Recent = lazy(() => import('./pages/Recent'))
const Stats = lazy(() => import('./pages/Stats'))
const HotCharts = lazy(() => import('./pages/HotCharts'))
const LocalFiles = lazy(() => import('./pages/LocalFiles'))
const RingtoneMaker = lazy(() => import('./pages/RingtoneMaker'))
const MoodRadio = lazy(() => import('./pages/MoodRadio'))
const GuessGame = lazy(() => import('./pages/GuessGame'))
const AIRecommend = lazy(() => import('./pages/AIRecommend'))
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const UserList = lazy(() => import('./pages/admin/UserList'))
const Analytics = lazy(() => import('./pages/admin/Analytics'))
const SystemMonitor = lazy(() => import('./pages/admin/SystemMonitor'))
const EnvManager = lazy(() => import('./pages/admin/EnvManager'))
const RedisBrowser = lazy(() => import('./pages/admin/RedisBrowser'))
const LogViewer = lazy(() => import('./pages/admin/LogViewer'))
const AppBuilder = lazy(() => import('./pages/admin/AppBuilder'))
const ApiMonitor = lazy(() => import('./pages/admin/ApiMonitor'))
const AnnouncementList = lazy(() => import('./pages/admin/AnnouncementList'))
const DatabaseManager = lazy(() => import('./pages/admin/DatabaseManager'))
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'))
const SourceManager = lazy(() => import('./pages/admin/SourceManager'))
const UserSourceManager = lazy(() => import('./pages/SourceManager'))
const LoginHistory = lazy(() => import('./pages/LoginHistory'))
const DownloadPage = lazy(() => import('./pages/Download'))

function PageLoader() {
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-tertiary)',
    }}>
      加载中...
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuthStore()
  if (isLoading) {
    return <PageLoader />
  }
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { verifyAdmin } = useAdminAuthStore()
  const [checking, setChecking] = useState(true)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    verifyAdmin().then(r => { setOk(r); setChecking(false) })
  }, [])

  if (checking) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-tertiary)',
      }}>验证权限中...</div>
    )
  }
  if (!ok) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

export default function App() {
  const { init: initAuth } = useAuthStore()
  const { init: initTheme } = useThemeStore()

  useEffect(() => {
    initTheme()
    initAuth()
  }, [])

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/download" element={<DownloadPage />} />

          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={
            <AdminGuard><AdminLayout /></AdminGuard>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<UserList />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="system" element={<SystemMonitor />} />
            <Route path="config" element={<EnvManager />} />
            <Route path="cache" element={<RedisBrowser />} />
            <Route path="logs" element={<LogViewer />} />
            <Route path="builds" element={<AppBuilder />} />
            <Route path="monitor" element={<ApiMonitor />} />
            <Route path="announcements" element={<AnnouncementList />} />
            <Route path="database" element={<DatabaseManager />} />
            <Route path="audit" element={<AuditLogs />} />
            <Route path="sources" element={<SourceManager />} />
          </Route>

          {/* User routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Search />} />
            <Route path="playlists" element={<Playlists />} />
            <Route path="recent" element={<Recent />} />
            <Route path="stats" element={<Stats />} />
            <Route path="hot" element={<HotCharts />} />
            <Route path="local" element={<LocalFiles />} />
            <Route path="ringtone" element={<RingtoneMaker />} />
            <Route path="mood" element={<MoodRadio />} />
            <Route path="guess" element={<GuessGame />} />
            <Route path="recommend" element={<AIRecommend />} />
            <Route path="login-history" element={<LoginHistory />} />
            <Route path="settings/sources" element={<UserSourceManager />} />
            <Route path="download" element={<DownloadPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
