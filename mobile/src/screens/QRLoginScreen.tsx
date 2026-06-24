import React, { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import QRCode from 'react-native-qrcode-svg'
import api from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type QRStatus = 'loading' | 'pending' | 'scanned' | 'confirmed' | 'expired'

export default function QRLoginScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const loginWithTokens = useAuthStore((s) => s.loginWithTokens)

  const [qrCode, setQrCode] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [qrStatus, setQrStatus] = useState<QRStatus>('loading')
  const [countdown, setCountdown] = useState(60)

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current)
      countdownTimer.current = null
    }
  }, [])

  const startCountdown = useCallback(() => {
    setCountdown(60)
    countdownTimer.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimer.current) clearInterval(countdownTimer.current)
          setQrStatus('expired')
          stopPolling()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [stopPolling])

  const startPolling = useCallback(
    (code: string) => {
      if (pollTimer.current) clearInterval(pollTimer.current)
      pollTimer.current = setInterval(async () => {
        try {
          const { data } = await api.get('/qrcode/status', { params: { code } })
          if (data.status === 'scanned') {
            setQrStatus('scanned')
          } else if (data.status === 'confirmed') {
            setQrStatus('confirmed')
            stopPolling()
            await loginWithTokens(data.access_token, data.refresh_token)
          }
        } catch {
          // network error, keep polling
        }
      }, 1000)
    },
    [loginWithTokens, stopPolling]
  )

  const generateQR = useCallback(async () => {
    setQrStatus('loading')
    stopPolling()
    try {
      const { data } = await api.post('/qrcode/generate')
      setQrCode(data.code)
      setQrUrl(data.url)
      setQrStatus('pending')
      startCountdown()
      startPolling(data.code)
    } catch (e: any) {
      Alert.alert('错误', '生成二维码失败，请重试')
      setQrStatus('expired')
    }
  }, [startCountdown, startPolling, stopPolling])

  useEffect(() => {
    generateQR()
    return () => {
      stopPolling()
    }
  }, [generateQR, stopPolling])

  const renderStatusText = () => {
    switch (qrStatus) {
      case 'loading':
        return '正在生成二维码...'
      case 'pending':
        return '请使用手机扫描二维码登录'
      case 'scanned':
        return '扫描成功，请在手机上确认登录'
      case 'confirmed':
        return '登录成功，正在跳转...'
      case 'expired':
        return '二维码已过期'
      default:
        return ''
    }
  }

  const statusColor = (): string => {
    switch (qrStatus) {
      case 'scanned':
        return '#22c55e'
      case 'confirmed':
        return '#22c55e'
      case 'expired':
        return '#ef4444'
      default:
        return '#64748b'
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#EC4141" />
      </TouchableOpacity>

      <Text style={styles.title}>扫码登录</Text>
      <Text style={styles.subtitle}>打开 HappyMusic App 扫描二维码</Text>

      <View style={styles.qrContainer}>
        {qrStatus === 'loading' ? (
          <ActivityIndicator size="large" color="#EC4141" />
        ) : qrStatus === 'expired' ? (
          <View style={styles.expiredContainer}>
            <Ionicons name="qr-code-outline" size={120} color="#cbd5e1" />
            <TouchableOpacity style={styles.regenerateButton} onPress={generateQR}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.regenerateText}>重新生成</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.qrWrapper}>
            <QRCode value={qrUrl} size={200} color="#1e293b" backgroundColor="#fff" />
            {qrStatus === 'scanned' && (
              <View style={styles.scannedOverlay}>
                <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
              </View>
            )}
          </View>
        )}
      </View>

      <Text style={[styles.statusText, { color: statusColor() }]}>{renderStatusText()}</Text>

      {qrStatus === 'pending' && countdown > 0 && (
        <Text style={styles.countdown}>{countdown}s 后过期</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    paddingTop: 12,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    padding: 8,
    zIndex: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 32,
  },
  qrContainer: {
    width: 240,
    height: 240,
    backgroundColor: '#fff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 24,
  },
  qrWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannedOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expiredContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EC4141',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  regenerateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  countdown: {
    fontSize: 13,
    color: '#94a3b8',
  },
})
