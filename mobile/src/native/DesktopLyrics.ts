import { NativeModules, Platform } from 'react-native'

const DesktopLyricsNative = NativeModules.DesktopLyrics

export const DesktopLyricsModule = {
  checkOverlayPermission(): Promise<boolean> {
    if (Platform.OS !== 'android' || !DesktopLyricsNative) return Promise.resolve(false)
    return DesktopLyricsNative.checkOverlayPermission()
  },

  requestOverlayPermission() {
    if (Platform.OS !== 'android' || !DesktopLyricsNative) return
    DesktopLyricsNative.requestOverlayPermission()
  },

  startFloatingLyrics() {
    if (Platform.OS !== 'android' || !DesktopLyricsNative) return
    DesktopLyricsNative.startFloatingLyrics()
  },

  stopFloatingLyrics() {
    if (Platform.OS !== 'android' || !DesktopLyricsNative) return
    DesktopLyricsNative.stopFloatingLyrics()
  },

  updateLyrics(currentLine: string, nextLine: string) {
    if (Platform.OS !== 'android' || !DesktopLyricsNative) return
    DesktopLyricsNative.updateLyrics(currentLine, nextLine)
  },

  clearLyrics() {
    if (Platform.OS !== 'android' || !DesktopLyricsNative) return
    DesktopLyricsNative.clearLyrics()
  },
}
