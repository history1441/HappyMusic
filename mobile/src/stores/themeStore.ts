// 主题 Store 已下沉到 common 共享层(三端统一)
// 持久化通过 mobileAdapter 的 StorageAdapter(expo-file-system)
// 旧 theme.json 数据不再读取,首次启动重置为 system 主题
export { useThemeStore } from '@happymusic/common'
export type { ThemeMode } from '@happymusic/common'
