import { StatusBar } from 'expo-status-bar'
import { useTheme } from '../hooks/useTheme'

export function ThemeStatusBar() {
  const { isDark } = useTheme()
  return <StatusBar style={isDark ? 'light' : 'dark'} />
}
