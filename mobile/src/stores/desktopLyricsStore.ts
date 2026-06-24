import { create } from 'zustand'
import * as FileSystem from 'expo-file-system/legacy'
import { DesktopLyricsModule } from '../native/DesktopLyrics'

type LyricsMode = 'off' | 'float'

const STORE_FILE = `${FileSystem.documentDirectory}desktop_lyrics.json`

interface DesktopLyricsState {
  mode: LyricsMode
  setMode: (mode: LyricsMode) => void
  init: () => Promise<void>
}

export const useDesktopLyricsStore = create<DesktopLyricsState>((set, get) => ({
  mode: 'off',

  setMode: async (mode: LyricsMode) => {
    const prev = get().mode

    if (prev === 'float') DesktopLyricsModule.stopFloatingLyrics()

    if (mode === 'float') {
      const hasPermission = await DesktopLyricsModule.checkOverlayPermission()
      if (!hasPermission) {
        DesktopLyricsModule.requestOverlayPermission()
        return
      }
      DesktopLyricsModule.startFloatingLyrics()
    }

    set({ mode })
    try {
      await FileSystem.writeAsStringAsync(STORE_FILE, JSON.stringify({ mode }))
    } catch {}
  },

  init: async () => {
    try {
      const info = await FileSystem.getInfoAsync(STORE_FILE)
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(STORE_FILE)
        const data = JSON.parse(content)
        const mode = data.mode === 'float' || data.mode === 'notification' ? 'float' : 'off'
        set({ mode })
        if (mode === 'float') {
          const hasPermission = await DesktopLyricsModule.checkOverlayPermission()
          if (hasPermission) DesktopLyricsModule.startFloatingLyrics()
        }
      }
    } catch {}
  },
}))
