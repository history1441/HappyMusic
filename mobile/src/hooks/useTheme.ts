import { useColorScheme } from 'react-native'
import { useThemeStore } from '../stores/themeStore'
import { lightColors, darkColors } from '../utils/theme'

export function useTheme() {
  const { mode } = useThemeStore()
  const systemDark = useColorScheme() === 'dark'
  const isDark = mode === 'system' ? systemDark : mode === 'dark'
  return { colors: isDark ? darkColors : lightColors, isDark }
}
