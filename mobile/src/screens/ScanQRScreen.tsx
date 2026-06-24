import React, { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { CameraView, Camera } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import api from '../services/api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function ScanQRScreen() {
  const insets = useSafeAreaInsets()
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [scanned, setScanned] = useState(false)
  const navigation = useNavigation()

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync()
      setHasPermission(status === 'granted')
    })()
  }, [])

  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned) return
    setScanned(true)

    let code = ''
    try {
      if (data.includes('qrcode-login')) {
        const parts = data.split('qrcode-login/')
        code = parts[parts.length - 1].split(/[?&#]/)[0]
      } else if (data.includes('code=')) {
        const url = new URL(data)
        code = url.searchParams.get('code') || ''
      } else {
        code = data
      }
    } catch {
      code = data
    }

    if (!code) {
      Alert.alert('无效二维码', '请扫描 Web 端登录页面的二维码')
      setScanned(false)
      return
    }

    try {
      const { data: result } = await api.post('/qrcode/scan', null, { params: { code } })
      Alert.alert(
        '扫码成功',
        `确认登录 Web 端？\n账号: ${result.username || '当前账号'}`,
        [
          { text: '取消', style: 'cancel', onPress: () => setScanned(false) },
          {
            text: '确认登录',
            onPress: async () => {
              try {
                await api.post('/qrcode/confirm', null, { params: { code } })
                Alert.alert('登录成功', 'Web 端已登录', [
                  { text: '确定', onPress: () => navigation.goBack() },
                ])
              } catch (e: any) {
                Alert.alert('确认失败', e.response?.data?.detail || '请重试')
                setScanned(false)
              }
            },
          },
        ],
        { cancelable: false }
      )
    } catch (e: any) {
      Alert.alert('扫码失败', e.response?.data?.detail || '二维码可能已过期')
      setScanned(false)
    }
  }

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#EC4141" />
        <Text style={{ marginTop: 12, color: '#64748b' }}>请求相机权限...</Text>
      </View>
    )
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={64} color="#cbd5e1" />
        <Text style={{ marginTop: 16, color: '#64748b', textAlign: 'center', paddingHorizontal: 32 }}>
          需要相机权限才能扫描二维码，请在系统设置中开启
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={{ color: '#EC4141', fontSize: 15 }}>返回</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>扫描二维码登录 Web</Text>
        <View style={{ width: 44 }} />
      </View>

      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>

      <View style={styles.bottomBar}>
        <Text style={styles.hint}>
          {scanned ? '处理中...' : '将 Web 端二维码放入框内'}
        </Text>
        {scanned && (
          <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={{ color: '#fff', marginLeft: 4 }}>重新扫描</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, paddingHorizontal: 12, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  backBtn: { marginTop: 20, padding: 10, backgroundColor: '#f1f5f9', borderRadius: 8 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scanArea: {
    width: 240, height: 240,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute', width: 24, height: 24,
    borderColor: '#EC4141',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingVertical: 32, paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center',
  },
  hint: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 12 },
  rescanBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EC4141', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20,
  },
})
