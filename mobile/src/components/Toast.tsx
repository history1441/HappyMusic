import React, { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

let toastTimeout: ReturnType<typeof setTimeout> | null = null
let _setToast: ((msg: string) => void) | null = null

export function showToast(message: string, duration = 2000) {
  if (_setToast) _setToast(message)
  if (toastTimeout) clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => {
    if (_setToast) _setToast('')
  }, duration)
}

export default function Toast() {
  const [message, setMessage] = useState('')
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => { _setToast = setMessage }, [])

  useEffect(() => {
    if (message) {
      Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.ease, useNativeDriver: true }).start()
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start()
    }
  }, [message])

  if (!message) return null

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Ionicons name="musical-note" size={14} color="#EC4141" />
      <Text style={styles.text} numberOfLines={1}>{message}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 80, left: '15%', right: '15%',
    backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, paddingHorizontal: 16, gap: 6,
    zIndex: 9999, elevation: 10,
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '500' },
})
