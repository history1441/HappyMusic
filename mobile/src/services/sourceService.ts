import * as FileSystem from 'expo-file-system/legacy'
import { getApiUrl } from '../utils/constants'
import { getCachedAccessToken } from './api'

export interface SourceInfo {
  id: string
  name: string
  enabled: boolean
}

const SOURCES_FILE = `${FileSystem.documentDirectory}selected_sources.json`

let _availableSources: SourceInfo[] = []
let _selectedSources: string[] | null = null

export function getAvailableSources(): SourceInfo[] {
  return _availableSources
}

export async function loadSourcesFromBackend(): Promise<SourceInfo[]> {
  try {
    const token = getCachedAccessToken()
    const res = await fetch(`${getApiUrl()}/api/sources`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    _availableSources = (data.sources || []).filter((s: SourceInfo) => s.enabled)
    return _availableSources
  } catch (e) {
    console.warn('loadSourcesFromBackend failed:', e)
    return []
  }
}

export async function getSelectedSources(): Promise<string[]> {
  if (_selectedSources !== null) return _selectedSources
  try {
    const info = await FileSystem.getInfoAsync(SOURCES_FILE)
    if (info.exists) {
      const content = await FileSystem.readAsStringAsync(SOURCES_FILE)
      const data = JSON.parse(content)
      if (Array.isArray(data.sources)) {
        _selectedSources = data.sources
        return _selectedSources
      }
    }
  } catch {}
  // 默认返回全部可用源
  _selectedSources = _availableSources.map(s => s.id)
  return _selectedSources
}

export async function saveSelectedSources(ids: string[]): Promise<void> {
  _selectedSources = ids
  try {
    await FileSystem.writeAsStringAsync(SOURCES_FILE, JSON.stringify({ sources: ids }))
  } catch (e) {
    console.warn('saveSelectedSources failed:', e)
  }
}
