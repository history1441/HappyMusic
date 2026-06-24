import { create } from 'zustand'
import api from '../services/api'
import type { User } from '../types'

interface AuthState {
  user: User | null
  isLoading: boolean
  isLoggedIn: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  init: () => Promise<void>
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isLoggedIn: false,

  login: async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    const { data: me } = await api.get('/auth/me')
    set({ user: me, isLoggedIn: true })
  },

  register: async (username, password) => {
    const { data } = await api.post('/auth/register', { username, password })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    const { data: me } = await api.get('/auth/me')
    set({ user: me, isLoggedIn: true })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isLoggedIn: false })
  },

  setTokens: async (accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    const { data: me } = await api.get('/auth/me')
    set({ user: me, isLoggedIn: true })
  },

  fetchMe: async () => {
    const { data } = await api.get('/auth/me')
    set({ user: data, isLoggedIn: true })
  },

  init: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      set({ isLoading: false })
      return
    }
    try {
      const { data } = await api.get('/auth/me')
      set({ user: data, isLoggedIn: true, isLoading: false })
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ isLoading: false })
    }
  },
}))
