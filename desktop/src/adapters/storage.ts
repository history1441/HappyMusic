import type { StorageAdapter } from '@common/adapters'
import { load, type Store } from '@tauri-apps/plugin-store'

let store: Store | null = null

async function getStore(): Promise<Store> {
  if (!store) {
    store = await load('app-store.json', { autoSave: false } as any)
  }
  return store
}

export const desktopStorage: StorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const s = await getStore()
    const val = await s.get<string>(key)
    return val ?? null
  },
  async setItem(key: string, value: string): Promise<void> {
    const s = await getStore()
    await s.set(key, value)
    await s.save()
  },
  async removeItem(key: string): Promise<void> {
    const s = await getStore()
    await s.delete(key)
    await s.save()
  },
}
