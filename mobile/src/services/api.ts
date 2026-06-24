import axios from 'axios'
import * as FileSystem from 'expo-file-system/legacy'
import { getApiUrl } from '../utils/constants'
import type { User } from '../types'

const TOKEN_FILE = `${FileSystem.documentDirectory}auth_tokens.json`

let cachedAccessToken: string | null = null
let cachedRefreshToken: string | null = null
let cachedUser: User | null = null

interface StoredData {
  access: string | null
  refresh: string | null
  user?: User | null
}

async function readFromFile(): Promise<StoredData> {
  try {
    const info = await FileSystem.getInfoAsync(TOKEN_FILE)
    if (!info.exists) return { access: null, refresh: null }
    const content = await FileSystem.readAsStringAsync(TOKEN_FILE)
    return JSON.parse(content)
  } catch {
    return { access: null, refresh: null }
  }
}

async function writeToFile(data: StoredData) {
  try {
    await FileSystem.writeAsStringAsync(TOKEN_FILE, JSON.stringify(data))
  } catch (e) {
    console.warn('Token file write failed:', e)
  }
}

export async function initTokenCache() {
  const data = await readFromFile()
  cachedAccessToken = data.access
  cachedRefreshToken = data.refresh
  cachedUser = data.user || null
}

export function getCachedAccessToken() {
  return cachedAccessToken
}

export function getCachedRefreshToken() {
  return cachedRefreshToken
}

export function getCachedUser(): User | null {
  return cachedUser
}

export function setTokenCache(access: string | null, refresh: string | null, user?: User | null) {
  cachedAccessToken = access
  cachedRefreshToken = refresh
  if (user !== undefined) cachedUser = user
  writeToFile({ access, refresh, user: cachedUser })
}

export function clearTokenCache() {
  cachedAccessToken = null
  cachedRefreshToken = null
  cachedUser = null
  writeToFile({ access: null, refresh: null, user: null })
}

const api = axios.create({
  timeout: 30000,
})

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
