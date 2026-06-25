import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { useNetworkStore } from '../stores/networkStore'

/**
 * 离线横幅:网络断开时从顶部滑入,恢复后自动隐藏。
 * 放置在 App 根布局,覆盖所有页面。
 */
export default function OfflineBanner() {
  const isOnline = useNetworkStore(s => s.isOnline)
  const [show, setShow] = useState(false)
  const [fadeAnim] = useState(new Animated.Value(0))

  useEffect(() => {
    // 短暂延迟避免网络抖动导致频繁闪烁
    let timer: ReturnType<typeof setTimeout> | null = null
    if (!isOnline) {
      timer = setTimeout(() => setShow(true), 800)
    } else {
      setShow(false)
    }

    Animated.timing(fadeAnim, {
      toValue: !isOnline && show ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start()

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [isOnline, show, fadeAnim])

  if (!show) return null

  return (
    <Animated.View style={[styles.banner, { opacity: fadeAnim }]}>
      <Text style={styles.text}>网络未连接,部分功能不可用</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  text: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
})
