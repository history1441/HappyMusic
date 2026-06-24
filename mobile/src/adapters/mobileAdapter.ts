import type { PlatformAdapter } from '@happymusic/common'
import * as FileSystem from 'expo-file-system/legacy'

const storage = {
  async getItem(key: string) {
    const filePath = `${FileSystem.documentDirectory}${key}`
    try {
      const info = await FileSystem.getInfoAsync(filePath)
      if (!info.exists) return null
      return await FileSystem.readAsStringAsync(filePath)
    } catch { return null }
  },
  async setItem(key: string, value: string) {
    const filePath = `${FileSystem.documentDirectory}${key}`
    await FileSystem.writeAsStringAsync(filePath, value)
  },
  async removeItem(key: string) {
    const filePath = `${FileSystem.documentDirectory}${key}`
    try { await FileSystem.deleteAsync(filePath) } catch {}
  },
}

const stub = new Proxy({} as any, {
  get: () => () => Promise.resolve(),
})

const mobileAdapter: PlatformAdapter = {
  storage,
  audio: stub,
  db: stub,
  fs: stub,
  platformName: () => 'android',
}

export function initAdapter() {
  const { setPlatformAdapter } = require('@happymusic/common') as typeof import('@happymusic/common')
  setPlatformAdapter(mobileAdapter)
}
