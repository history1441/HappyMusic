import { create } from 'zustand'
import * as FileSystem from 'expo-file-system/legacy'

const FILE = `${FileSystem.documentDirectory}comfort_settings.json`

export const TTS_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', gender: '女', desc: '温柔知性' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊', gender: '女', desc: '活泼可爱' },
  { id: 'zh-CN-YunjianNeural', name: '云健', gender: '男', desc: '沉稳大气' },
  { id: 'zh-CN-YunxiNeural', name: '云希', gender: '男', desc: '阳光少年' },
  { id: 'zh-CN-YunyangNeural', name: '云扬', gender: '男', desc: '新闻播报' },
  { id: 'zh-CN-YunxiaNeural', name: '云霞', gender: '男', desc: '童声' },
  { id: 'zh-HK-HiuGaaiNeural', name: '曉佳', gender: '女', desc: '粤语' },
  { id: 'zh-TW-HsiaoChenNeural', name: '曉臻', gender: '女', desc: '台湾腔' },
] as const

export type TTSVoiceId = typeof TTS_VOICES[number]['id']

interface ComfortState {
  enabled: boolean
  voice: TTSVoiceId
  songsSinceLast: number
  setEnabled: (v: boolean) => void
  setVoice: (v: TTSVoiceId) => void
  recordSongPlayed: () => boolean
  resetCounter: () => void
  init: () => Promise<void>
}

function persist(state: { enabled: boolean; voice: TTSVoiceId; songsSinceLast: number }) {
  try {
    FileSystem.writeAsStringAsync(FILE, JSON.stringify(state))
  } catch {}
}

export const useComfortStore = create<ComfortState>((set, get) => ({
  enabled: true,
  voice: 'zh-CN-XiaoxiaoNeural',
  songsSinceLast: 0,

  setEnabled: (v: boolean) => {
    set({ enabled: v })
    persist(get())
  },

  setVoice: (v: TTSVoiceId) => {
    set({ voice: v })
    persist(get())
  },

  recordSongPlayed: () => {
    const state = get()
    if (!state.enabled) return false
    const next = state.songsSinceLast + 1
    set({ songsSinceLast: next })
    persist(get())
    if (next >= 10) return true
    return Math.random() < 0.1
  },

  resetCounter: () => {
    set({ songsSinceLast: 0 })
    persist(get())
  },

  init: async () => {
    try {
      const info = await FileSystem.getInfoAsync(FILE)
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(FILE)
        const data = JSON.parse(content)
        if (typeof data.enabled === 'boolean') set({ enabled: data.enabled })
        if (typeof data.songsSinceLast === 'number') set({ songsSinceLast: data.songsSinceLast })
        if (typeof data.voice === 'string') set({ voice: data.voice })
      }
    } catch {}
  },
}))
