import axios from 'axios'
import type { User } from '../types'
import { getAdapter } from '../adapters'

const TOKEN_KEY = 'auth_tokens.json'

let cachedAccessToken: string | null = null
let cachedRefreshToken: string | null = null
let cachedUser: User | null = null
let _apiUrl = 'https://music.dyun.org'

export function getApiUrl(): string {
  return _apiUrl
}

export function setApiUrl(url: string) {
  _apiUrl = url.trim().replace(/\/+$/, '')
}

export async function loadSavedApiUrl(): Promise<string> {
  try {
    const content = await getAdapter().storage.getItem('api_url.json')
    if (content) {
      const data = JSON.parse(content)
      if (data.apiUrl && typeof data.apiUrl === 'string') {
        _apiUrl = data.apiUrl
      }
    }
  } catch {}
  return _apiUrl
}

export async function saveApiUrl(url: string): Promise<void> {
  const trimmed = url.trim().replace(/\/+$/, '')
  _apiUrl = trimmed
  try {
    await getAdapter().storage.setItem('api_url.json', JSON.stringify({ apiUrl: trimmed }))
  } catch (e) {
    console.warn('saveApiUrl failed:', e)
  }
}

export async function initTokenCache() {
  try {
    const raw = await getAdapter().storage.getItem(TOKEN_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      cachedAccessToken = data.access || null
      cachedRefreshToken = data.refresh || null
      cachedUser = data.user || null
    }
  } catch {}
}

export function getCachedAccessToken() { return cachedAccessToken }
export function getCachedRefreshToken() { return cachedRefreshToken }
export function getCachedUser(): User | null { return cachedUser }

export async function setTokenCache(access: string | null, refresh: string | null, user?: User | null) {
  cachedAccessToken = access
  cachedRefreshToken = refresh
  if (user !== undefined) cachedUser = user
  try {
    await getAdapter().storage.setItem(TOKEN_KEY, JSON.stringify({
      access, refresh, user: cachedUser,
    }))
  } catch (e) {
    console.warn('Token save failed:', e)
  }
}

export async function clearTokenCache() {
  cachedAccessToken = null
  cachedRefreshToken = null
  cachedUser = null
  try {
    await getAdapter().storage.removeItem(TOKEN_KEY)
  } catch {}
}

const api = axios.create({ timeout: 30000 })

api.interceptors.request.use((config) => {
  config.baseURL = `${getApiUrl()}/api`
  if (cachedAccessToken) {
    config.headers.Authorization = `Bearer ${cachedAccessToken}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      if (cachedRefreshToken) {
        try {
          const { data } = await api.post('/auth/refresh', null, { params: { refresh: cachedRefreshToken } })
          setTokenCache(data.access_token, data.refresh_token)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          setTokenCache(null, null)
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
