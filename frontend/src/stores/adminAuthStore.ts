import { create } from 'zustand'
import api from '../services/api'

interface AdminAuthState {
  isAdmin: boolean
  adminUser: { id: number; username: string; role: string; nickname: string } | null
  adminLogin: (username: string, password: string) => Promise<boolean>
  adminLogout: () => void
  verifyAdmin: () => Promise<boolean>
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  isAdmin: !!localStorage.getItem('admin_token'),
  adminUser: null,

  adminLogin: async (username, password) => {
    try {
      const { data } = await api.post('/admin/login', { username, password })
      localStorage.setItem('admin_token', data.access_token)
      set({ isAdmin: true })
      return true
    } catch {
      return false
    }
  },

  adminLogout: () => {
    localStorage.removeItem('admin_token')
    set({ isAdmin: false, adminUser: null })
  },

  verifyAdmin: async () => {
    try {
      const token = localStorage.getItem('admin_token')
      if (!token) return false
      const { data } = await api.get('/admin/verify', {
        headers: { Authorization: `Bearer ${token}` },
      })
      set({ isAdmin: data.valid, adminUser: data })
      return data.valid
    } catch (e: any) {
      const status = e?.response?.status
      // 仅 401/403 才清理 token;网络抖动/超时(无 status)保留 token 以便下次重试
      if (status === 401 || status === 403) {
        set({ isAdmin: false })
        localStorage.removeItem('admin_token')
      }
      return false
    }
  },
}))
