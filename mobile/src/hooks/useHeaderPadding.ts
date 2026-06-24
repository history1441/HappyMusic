import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function useHeaderPadding(): number {
  const { top } = useSafeAreaInsets()
  return top + 12
}
