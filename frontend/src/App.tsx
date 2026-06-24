import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { useThemeStore } from './stores/themeStore'
import { useAdminAuthStore } from './stores/adminAuthStore'
import Layout from './components/Layout'
import AdminLayout from './components/admin/AdminLayout'
import Login from './pages/Login'
import Search from './pages/Search'
import Playlists from './pages/Playlists'
import Recent from './pages/Recent'
import Stats from './pages/Stats'
import HotCharts from './pages/HotCharts'
import LocalFiles from './pages/LocalFiles'
import RingtoneMaker from './pages/RingtoneMaker'
import MoodRadio from './pages/MoodRadio'
import GuessGame from './pages/GuessGame'
import AIRecommend from './pages/AIRecommend'
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import UserList from './pages/admin/UserList'
import Analytics from './pages/admin/Analytics'
import SystemMonitor from './pages/admin/SystemMonitor'
import EnvManager from './pages/admin/EnvManager'
import RedisBrowser from './pages/admin/RedisBrowser'
import LogViewer from './pages/admin/LogViewer'
import AppBuilder from './pages/admin/AppBuilder'
import ApiMonitor from './pages/admin/ApiMonitor'
import AnnouncementList from './pages/admin/AnnouncementList'
import DatabaseManager from './pages/admin/DatabaseManager'
import AuditLogs from './pages/admin/AuditLogs'
import SourceManager from './pages/admin/SourceManager'
import UserSourceManager from './pages/SourceManager'
import LoginHistory from './pages/LoginHistory'
import DownloadPage from './pages/Download'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuthStore()
  if (isLoading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-tertiary)',
      }}>
        加载中...
      </div>
    )
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
    </BrowserRouter>
  )
}
