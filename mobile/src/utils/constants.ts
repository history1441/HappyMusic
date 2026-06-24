import * as FileSystem from 'expo-file-system/legacy'

export const APP_VERSION = '1.8.13'

const DEFAULT_API_URL = 'https://music.dyun.org'
const API_URL_FILE = `${FileSystem.documentDirectory}api_url.json`

let _apiUrl = DEFAULT_API_URL

export function getApiUrl(): string {
  return _apiUrl
}

export async function loadSavedApiUrl(): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(API_URL_FILE)
    if (info.exists) {
      const content = await FileSystem.readAsStringAsync(API_URL_FILE)
      const data = JSON.parse(content)
      if (data.apiUrl && typeof data.apiUrl === 'string') {
        _apiUrl = data.apiUrl
        return _apiUrl
      }
    }
  } catch {}
  return _apiUrl
}

export async function saveApiUrl(url: string): Promise<void> {
  const trimmed = url.trim().replace(/\/+$/, '')
  _apiUrl = trimmed
  try {
    await FileSystem.writeAsStringAsync(API_URL_FILE, JSON.stringify({ apiUrl: trimmed }))
  } catch (e) {
    console.warn('saveApiUrl failed:', e)
  }
}

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
}

async function tryFetch(url: string): Promise<boolean> {
  try {
    const res = await Promise.race([
      fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'HappyMusic/' + APP_VERSION },
      }),
      timeoutPromise(10000),
    ])
    console.warn(`health check ${url} -> status ${res.status}`)
    return res.ok
  } catch (e: any) {
    console.warn(`health check ${url} -> error: ${e?.message || e}`)
    return false
  }
}

export async function checkBackendReachable(url?: string): Promise<boolean> {
  const target = (url || _apiUrl).replace(/\/+$/, '')
  return tryFetch(`${target}/api/health`)
}

export const CACHE_DIR = 'music_cache'
export const DOWNLOAD_DIR = 'music_downloads'
export const CACHE_EXPIRE_DAYS = 7
