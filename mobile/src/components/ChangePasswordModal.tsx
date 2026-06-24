import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native'
import api from '../services/api'
import { useTheme } from '../hooks/useTheme'

interface Props {
  visible: boolean
  onClose: () => void
}

export default function ChangePasswordModal({ visible, onClose }: Props) {
  const { colors } = useTheme()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleClose = () => {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSubmitting(false)
    onClose()
  }

  const validate = (): string | null => {
    if (!oldPassword.trim()) return '请输入当前密码'
    if (!newPassword.trim()) return '请输入新密码'
    if (newPassword.length < 6) return '新密码至少需要6个字符'
    if (newPassword !== confirmPassword) return '两次输入的密码不一致'
    return null
  }

  const handleSubmit = async () => {
    const error = validate()
    if (error) {
      Alert.alert('验证失败', error)
      return
    }

    setSubmitting(true)
    try {
      await api.put('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      })
      Alert.alert('成功', '密码修改成功', [
        { text: '确定', onPress: handleClose },
      ])
    } catch (e: any) {
      const msg =
        e.response?.data?.detail ||
        e.response?.data?.message ||
        e.message ||
        '密码修改失败，请重试'
      Alert.alert('错误', msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={[styles.container, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.title, { color: colors.text }]}>修改密码</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: colors.textTertiary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>当前密码</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholder="请输入当前密码"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                editable={!submitting}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>新密码</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="至少6个字符"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                editable={!submitting}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>确认新密码</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="再次输入新密码"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                editable={!submitting}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: colors.primary },
                submitting && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.submitText}>
                {submitting ? '提交中...' : '确认修改'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 20,
  },
  form: {
    padding: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  submitBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
})
