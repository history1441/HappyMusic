import { create } from 'zustand'
import * as FileSystem from 'expo-file-system/legacy'

const DISCLAIMER_FILE = FileSystem.documentDirectory + 'disclaimer.json'

interface DisclaimerState {
  agreed: boolean
  agreedAt: string | null
  checkAgreed: () => Promise<boolean>
  setAgreed: () => Promise<void>
}

export const useDisclaimerStore = create<DisclaimerState>((set) => ({
  agreed: false,
  agreedAt: null,

  checkAgreed: async () => {
    try {
      const info = await FileSystem.getInfoAsync(DISCLAIMER_FILE)
      if (!info.exists) return false
      const content = await FileSystem.readAsStringAsync(DISCLAIMER_FILE)
      const data = JSON.parse(content)
      const isAgreed = data.agreed === true
      set({ agreed: isAgreed, agreedAt: data.agreedAt || null })
      return isAgreed
    } catch {
      return false
    }
  },

  setAgreed: async () => {
    const now = new Date().toISOString()
    await FileSystem.writeAsStringAsync(DISCLAIMER_FILE, JSON.stringify({ agreed: true, agreedAt: now }))
    set({ agreed: true, agreedAt: now })
  },
}))
