import { create } from 'zustand'
import api, {
  setTokenCache, clearTokenCache,
  getCachedAccessToken, getCachedRefreshToken, getCachedUser, initTokenCache,
} from '../services/api'
import { connectSync, disconnectSync } from '../services/syncService'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  /** onSyncCommand 可选:登录成功后注册 sync 命令处理器(mobile 传 player 控制,desktop/web 不传) */
  login: (username: string, password: string, onSyncCommand?: (msg: any) => void) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  loadToken: (onSyncCommand?: (msg: any) => void) => Promise<void>
}

/**
 * 认证 Store(三端共用)
 * - token 持久化走 common api.ts(StorageAdapter)
 * - sync 连接自动管理(login 连接,logout 断开)
 * - /auth/me 失败时清理 token(消除半登录状态)
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  login: async (username, password, onSyncCommand) => {
    const { data } = await api.post('/auth/login', { username, password })
    setTokenCache(data.access_token, data.refresh_token)
    try {
      const { data: userData } = await api.get('/auth/me')
      setTokenCache(data.access_token, data.refresh_token, userData)
      set({ token: data.access_token, user: userData, isLoading: false })
      connectSync(onSyncCommand)
    } catch {
      clearTokenCache()
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
      connectSync()
    } catch {
      clearTokenCache()
      set({ token: null, user: null, isLoading: false })
    }
  },

  logout: () => {
    disconnectSync()
    clearTokenCache()
    set({ user: null, token: null })
  },

  loadToken: async (onSyncCommand) => {
    await initTokenCache()
    const accessToken = getCachedAccessToken()
    const cachedUser = getCachedUser()

    if (!accessToken) {
      set({ token: null, user: cachedUser, isLoading: false })
      return
    }

    if (cachedUser) {
      set({ token: accessToken, user: cachedUser, isLoading: false })
    }

    try {
      const { data } = await api.get('/auth/me')
      setTokenCache(accessToken, getCachedRefreshToken(), data)
      set({ token: accessToken, user: data, isLoading: false })
      connectSync(onSyncCommand)
    } catch {
      const refreshToken = getCachedRefreshToken()
      if (refreshToken) {
        try {
          const { data } = await api.post('/auth/refresh', null, { params: { refresh: refreshToken } })
          setTokenCache(data.access_token, data.refresh_token)
          const { data: userData } = await api.get('/auth/me')
          setTokenCache(data.access_token, data.refresh_token, userData)
          set({ token: data.access_token, user: userData, isLoading: false })
          connectSync(onSyncCommand)
          return
        } catch {}
      }
      clearTokenCache()
      set({ token: null, user: null, isLoading: false })
    }
  },
}))
