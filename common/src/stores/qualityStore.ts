import { create } from 'zustand'
import { getAdapter } from '../adapters'
import type { QualityId } from '../utils/playerControls'

const STORAGE_KEY = 'audio_quality'
const VALID: QualityId[] = ['standard', 'high', 'lossless']

interface QualityState {
  quality: QualityId
  setQuality: (q: QualityId) => void
  init: () => Promise<void>
}

/**
 * 音质偏好 Store(三端共用)
 * 由于音源(musicdl)每首歌通常只返回单一下载地址,该偏好在搜索时作为「软排序」依据:
 *  - lossless: 优先 flac 等无损格式
 *  - high: 优先文件体积更大的高码率版本
 *  - standard: 优先体积小的省流版本
 * 当同一首歌存在多个版本时影响展示顺序。持久化通过 StorageAdapter。
 */
export const useQualityStore = create<QualityState>((set) => ({
  quality: 'high',

  setQuality: (quality) => {
    set({ quality })
    getAdapter().storage.setItem(STORAGE_KEY, quality).catch(() => {})
  },

  init: async () => {
    try {
      const saved = await getAdapter().storage.getItem(STORAGE_KEY)
      if (saved && VALID.includes(saved as QualityId)) {
        set({ quality: saved as QualityId })
      }
    } catch {}
  },
}))
