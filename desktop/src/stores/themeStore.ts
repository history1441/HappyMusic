import { useThemeStore as useCommonThemeStore } from '@happymusic/common'

/**
 * desktop 主题 Store 兼容层
 * 内部用 common 的 mode(三端统一),对外保留 isDark 接口(旧调用方兼容)
 * 持久化通过 desktopAdapter 的 StorageAdapter(Tauri plugin-store)
 */
export function useThemeStore() {
  const { mode, setMode, init } = useCommonThemeStore()
  const isDark = mode === 'dark'
  return {
    mode,
    isDark,
    toggle: () => setMode(mode === 'dark' ? 'light' : 'dark'),
    setMode,
    init,
  }
}
