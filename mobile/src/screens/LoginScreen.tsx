import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Modal,
} from 'react-native'
import { useAuthStore } from '../stores/authStore'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../hooks/useTheme'

const DISCLAIMER_TEXT = `免责声明 / 用户使用协议

一、应用性质
HappyMusic 是一款基于开源技术构建的个人音乐播放与管理应用，仅供个人学习、研究及非商业用途使用。

二、音乐来源说明
本应用中搜索、试听及下载的音乐内容均来源于第三方开源库 musicdl。本应用本身不存储、不缓存、不分发任何音乐文件。所有音乐文件的获取均由用户主动发起。

三、版权声明
1. 本应用不拥有任何通过 musicdl 获取的音乐内容的版权。
2. 所有音乐内容的版权归属于原版权持有者。
3. 用户在使用本应用时，应自行确保其行为符合所在国家/地区的版权法律法规。

四、用户责任
1. 用户不得将本应用及通过本应用获取的任何音乐内容用于商业用途。
2. 通过本应用下载的音乐文件，建议用户在 24 小时内删除。如需长期收听，请购买正版音乐。
3. 用户因使用本应用而产生的任何法律责任，由用户自行承担。

五、免责条款
1. 本应用不对 musicdl 库所获取的音乐内容的合法性作任何保证。
2. 本应用不对因使用本应用而导致的任何直接或间接损失承担责任。
3. 使用本应用即表示您已阅读、理解并同意遵守以上所有条款。`

export default function LoginScreen() {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const { login, register } = useAuthStore()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('提示', '请输入用户名和密码')
      return
    }
    setLoading(true)
    try {
      if (isRegister) {
        await register(username, password)
      } else {
        await login(username, password)
      }
    } catch (e: any) {
      Alert.alert('错误', e?.response?.data?.detail || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.inner, { paddingTop: insets.top }]}>
        <Text style={[styles.logo, { color: colors.primary }]}>HappyMusic</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{isRegister ? '注册新账号' : '登录你的账号'}</Text>

        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border }]}
          placeholder="用户名"
          placeholderTextColor={colors.textTertiary}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border }]}
          placeholder="密码"
          placeholderTextColor={colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? '处理中...' : (isRegister ? '注册' : '登录')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
          <Text style={[styles.switchText, { color: colors.primary }]}>
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.qrButton}>
          <Text style={[styles.qrText, { color: colors.textSecondary }]}>扫码登录</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.disclaimerLink} onPress={() => setShowDisclaimer(true)}>
          <Text style={[styles.disclaimerLinkText, { color: colors.textTertiary }]}>用户使用协议</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showDisclaimer} animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ padding: 16, paddingTop: insets.top + 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>用户使用协议</Text>
            <TouchableOpacity onPress={() => setShowDisclaimer(false)}><Text style={{ fontSize: 14, color: colors.textSecondary }}>关闭</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 20 }}><Text style={{ fontSize: 14, lineHeight: 24, color: colors.text }}>{DISCLAIMER_TEXT}</Text></ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 32 },
  input: {
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, marginBottom: 12, borderWidth: 1,
  },
  button: {
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchText: { textAlign: 'center', marginTop: 16, fontSize: 14 },
  qrButton: { marginTop: 24, alignItems: 'center' },
  qrText: { fontSize: 14 },
  disclaimerLink: { marginTop: 16, alignItems: 'center' },
  disclaimerLinkText: { fontSize: 12, textDecorationLine: 'underline' },
})
