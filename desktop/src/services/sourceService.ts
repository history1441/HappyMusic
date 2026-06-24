import { load, type Store } from '@tauri-apps/plugin-store'
import api from '@common/services/api'

export interface SourceInfo {
  id: string
  name: string
  enabled: boolean
}

const STORE_KEY = 'selected_sources'

let _availableSources: SourceInfo[] = []
let _selectedSources: string[] | null = null
let _store: Store | null = null

async function getStore(): Promise<Store> {
  if (!_store) {
    _store = await load('app-store.json', { autoSave: false } as any)
  }
  return _store
}

export function getAvailableSources(): SourceInfo[] {
  return _availableSources
}

export async function loadSourcesFromBackend(): Promise<SourceInfo[]> {
  try {
    const { data } = await api.get('/sources')
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
    const store = await getStore()
    const data = await store.get<{ sources: string[] }>(STORE_KEY)
    if (data && Array.isArray(data.sources)) {
      _selectedSources = data.sources
      return _selectedSources
    }
  } catch {}
  // Fallback: return all available sources
  _selectedSources = _availableSources.map(s => s.id)
  return _selectedSources
}

export async function saveSelectedSources(ids: string[]): Promise<void> {
  _selectedSources = ids
  try {
    const store = await getStore()
    await store.set(STORE_KEY, { sources: ids })
    await store.save()
  } catch (e) {
    console.warn('saveSelectedSources failed:', e)
  }
}
