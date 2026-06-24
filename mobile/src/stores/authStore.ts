import { create } from 'zustand'
import api, { initTokenCache, setTokenCache, getCachedAccessToken, getCachedRefreshToken, getCachedUser } from '../services/api'
import { connectSync, disconnectSync } from '../services/syncService'
import { syncRecentToCloud } from '../services/recentService'
import type { User } from '../types'

// Forward sync commands to player store
function handleSyncCommand(msg: any) {
  const { usePlayerStore } = require('../stores/playerStore')
  const store = usePlayerStore.getState()
  switch (msg.action) {
    case 'play':
    case 'resume':
      store.resume()
      break
    case 'pause':
      store.pause()
      break
    case 'next':
      store.next()
      break
    case 'prev':
      store.prev()
      break
    case 'toggle':
      store.togglePlay()
      break
    default:
      console.warn('Sync: unknown command action', msg.action)
  }
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  loadToken: () => Promise<void>
  loginWithTokens: (accessToken: string, refreshToken: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  login: async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password })
    setTokenCache(data.access_token, data.refresh_token)
    // Fetch user data after login
    try {
      const { data: userData } = await api.get('/auth/me')
      setTokenCache(data.access_token, data.refresh_token, userData)
      set({ token: data.access_token, user: userData, isLoading: false })
      connectSync(handleSyncCommand)
      syncRecentToCloud().catch(() => {})
    } catch (e) {
      // /auth/me 失败说明 token 无法换取用户信息,清理 token 避免半登录状态
      console.warn('login: /auth/me failed', e)
      setTokenCache(null, null, null)
      set({ token: null, user: null, isLoading: false })
    }
  },

  register: async (username, password) => {
    const { data } = await api.post('/auth/register', { username, password })
    setTokenCache(data.access_token, data.refresh_token)
    try {
      const { data: userData } = await api.get('/auth/me')
      setTokenCache(data.access_token, data.refresh_token, userData)
      set({ token: data.access_token, user: userData, isLoading: false })
      connectSync(handleSyncCommand)
    } catch (e) {
      console.warn('register: /auth/me failed', e)
      setTokenCache(null, null, null)
      set({ token: null, user: null, isLoading: false })
    }
  },

  logout: () => {
    disconnectSync()
    setTokenCache(null, null, null)
    set({ user: null, token: null })
  },

  loadToken: async () => {
    await initTokenCache()
    const accessToken = getCachedAccessToken()
    const cachedUser = getCachedUser()

    if (!accessToken) {
      set({ token: null, user: cachedUser, isLoading: false })
      return
    }

    // Show cached user immediately while validating
    if (cachedUser) {
      set({ token: accessToken, user: cachedUser, isLoading: false })
    }

    try {
      const { data } = await api.get('/auth/me')
      setTokenCache(accessToken, getCachedRefreshToken(), data)
      set({ token: accessToken, user: data, isLoading: false })
      connectSync(handleSyncCommand)
    } catch {
      const refreshToken = getCachedRefreshToken()
      if (refreshToken) {
        try {
          const { data } = await api.post('/auth/refresh', null, { params: { refresh: refreshToken } })
          setTokenCache(data.access_token, data.refresh_token)
          const { data: userData } = await api.get('/auth/me')
          setTokenCache(data.access_token, data.refresh_token, userData)
          set({ token: data.access_token, user: userData, isLoading: false })
          connectSync(handleSyncCommand)
          return
        } catch {}
      }
      setTokenCache(null, null, null)
      set({ token: null, user: null, isLoading: false })
    }
  },

  loginWithTokens: async (accessToken, refreshToken) => {
    setTokenCache(accessToken, refreshToken)
    try {
      const { data } = await api.get('/auth/me')
      setTokenCache(accessToken, refreshToken, data)
      set({ token: accessToken, user: data, isLoading: false })
      connectSync(handleSyncCommand)
    } catch {
      setTokenCache(null, null, null)
      set({ token: null, user: null, isLoading: false })
    }
  },
}))
