import { Routes, Route, Navigate, useNavigate } from 'react-router'
import { getCachedAccessToken } from '@common/services/api'
import { desktopStorage } from './adapters/storage'
import { useState, useEffect } from 'react'
import AppLayout from './layouts/AppLayout'
import AuthLayout from './layouts/AuthLayout'
import LoginScreen from './screens/LoginScreen'
import QRLoginScreen from './screens/QRLoginScreen'
import DisclaimerScreen from './screens/DisclaimerScreen'
import HomeScreen from './screens/HomeScreen'
import SearchScreen from './screens/SearchScreen'
import PlayerScreen from './screens/PlayerScreen'
import PlaylistScreen from './screens/PlaylistScreen'
import PlaylistDetailScreen from './screens/PlaylistDetailScreen'
import SettingsScreen from './screens/SettingsScreen'
import DownloadManagerScreen from './screens/DownloadManagerScreen'
import LocalLibraryScreen from './screens/LocalLibraryScreen'
import LocalFileImportScreen from './screens/LocalFileImportScreen'
import StorageScreen from './screens/StorageScreen'
import StatsScreen from './screens/StatsScreen'
import RecentPlaysScreen from './screens/RecentPlaysScreen'
import FavoritesScreen from './screens/FavoritesScreen'
import HotChartsScreen from './screens/HotChartsScreen'
import MoodRadioScreen from './screens/MoodRadioScreen'
import AIRecommendScreen from './screens/AIRecommendScreen'
import GuessGameScreen from './screens/GuessGameScreen'
import RingtoneMakerScreen from './screens/RingtoneMakerScreen'
import SourceManagerScreen from './screens/SourceManagerScreen'
import LoginHistoryScreen from './screens/LoginHistoryScreen'
import DesktopLyricsWindow from './screens/DesktopLyricsWindow'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = getCachedAccessToken()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function DisclaimerGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState<'loading' | 'need' | 'pass'>('loading')
  const navigate = useNavigate()

  useEffect(() => {
    desktopStorage.getItem('disclaimer_accepted').then(val => {
      if (val) {
        try { const d = JSON.parse(val); if (d.agreed) { setChecked('pass'); return } } catch {}
      }
      setChecked('need')
    })
  }, [])

  if (checked === 'loading') return <div className="flex h-full items-center justify-center"><span className="spinner" /></div>
  if (checked === 'need') return <DisclaimerScreen />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* 桌面歌词悬浮窗(独立 Tauri 窗口,无侧栏/无鉴权) */}
      <Route path="/desktop-lyrics" element={<DesktopLyricsWindow />} />

      {/* Auth routes (no sidebar) */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/qr-login" element={<QRLoginScreen />} />
      </Route>

      {/* Main app routes (with sidebar + mini player) */}
      <Route element={<ProtectedRoute><DisclaimerGuard><AppLayout /></DisclaimerGuard></ProtectedRoute>}>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/search" element={<SearchScreen />} />
        <Route path="/player" element={<PlayerScreen />} />
        <Route path="/playlists" element={<PlaylistScreen />} />
        <Route path="/playlist/:id" element={<PlaylistDetailScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/downloads" element={<DownloadManagerScreen />} />
        <Route path="/local" element={<LocalLibraryScreen />} />
        <Route path="/local/import" element={<LocalFileImportScreen />} />
        <Route path="/storage" element={<StorageScreen />} />
        <Route path="/stats" element={<StatsScreen />} />
        <Route path="/recent" element={<RecentPlaysScreen />} />
        <Route path="/favorites" element={<FavoritesScreen />} />
        <Route path="/hot-charts" element={<HotChartsScreen />} />
        <Route path="/mood-radio" element={<MoodRadioScreen />} />
        <Route path="/ai-recommend" element={<AIRecommendScreen />} />
        <Route path="/guess-game" element={<GuessGameScreen />} />
        <Route path="/ringtone" element={<RingtoneMakerScreen />} />
        <Route path="/sources" element={<SourceManagerScreen />} />
        <Route path="/login-history" element={<LoginHistoryScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
