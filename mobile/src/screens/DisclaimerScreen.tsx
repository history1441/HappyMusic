import React, { useRef, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

const DISCLAIMER_TEXT = `免责声明 / 用户使用协议

最后更新日期：2025年4月

一、应用性质

HappyMusic 是一款基于开源技术构建的个人音乐播放与管理应用，仅供个人学习、研究及非商业用途使用。本应用不以任何形式向用户收取费用，也不提供任何付费服务。

二、音乐来源说明

本应用中搜索、试听及下载的音乐内容均来源于第三方开源库 musicdl（https://github.com/CharlesPikachu/musicdl）。本应用本身不存储、不缓存、不分发任何音乐文件。所有音乐文件的获取均由用户主动发起，通过 musicdl 库从互联网公开资源中检索获取。

三、版权声明

1. 本应用不拥有任何通过 musicdl 获取的音乐内容的版权。
2. 所有音乐内容的版权归属于原版权持有者（包括但不限于唱片公司、音乐人、作词作曲者等）。
3. 用户在使用本应用时，应自行确保其行为符合所在国家/地区的版权法律法规。

四、用户责任

1. 用户不得将本应用及通过本应用获取的任何音乐内容用于商业用途，包括但不限于转售、出租、商业表演等。
2. 通过本应用下载的音乐文件，建议用户在 24 小时内删除。如需长期收听，请购买正版音乐。
3. 用户因使用本应用而产生的任何法律责任，由用户自行承担，与本应用开发者无关。

五、免责条款

1. 本应用不对 musicdl 库所获取的音乐内容的合法性、完整性、准确性作任何保证。
2. 本应用不对因使用本应用而导致的任何直接或间接损失承担责任，包括但不限于数据丢失、设备损坏、利润损失等。
3. 本应用不对第三方网站的可用性、安全性作任何保证。
4. 本应用不对用户因使用本应用而侵犯第三方版权的行为承担任何责任。

六、隐私保护

1. 本应用仅收集用户注册所需的必要信息（用户名、密码的哈希值）。
2. 本应用不会将用户的个人信息分享给任何第三方。
3. 用户的播放记录和歌单数据仅存储于用户所连接的服务器上。

七、协议变更

本协议的内容可能会不时更新。更新后的协议将在应用内公布，用户继续使用本应用即视为同意更新后的协议。

八、联系方式

如对本协议有任何疑问，请通过应用内的反馈功能联系开发者。

使用本应用即表示您已阅读、理解并同意遵守以上所有条款。`

interface Props {
  onAgreed: () => void
}

export default function DisclaimerScreen({ onAgreed }: Props) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)

  const handleScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20) {
      setScrolledToBottom(true)
    }
  }

  const handleAgree = async () => {
    const { useDisclaimerStore } = require('../stores/disclaimerStore')
    await useDisclaimerStore.getState().setAgreed()
    onAgreed()
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>用户使用协议</Text>
        <Text style={styles.subtitle}>请仔细阅读以下内容后继续</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.disclaimerText}>{DISCLAIMER_TEXT}</Text>
      </ScrollView>

      {!scrolledToBottom && (
        <View style={styles.scrollHint}>
          <Text style={styles.scrollHintText}>请向下滑动阅读全部内容</Text>
        </View>
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.agreeBtn, !scrolledToBottom && styles.agreeBtnDisabled]}
          onPress={handleAgree}
          disabled={!scrolledToBottom}
          activeOpacity={scrolledToBottom ? 0.7 : 1}
        >
          <Text style={[styles.agreeBtnText, !scrolledToBottom && styles.agreeBtnTextDisabled]}>
            {scrolledToBottom ? '我已阅读并同意' : '请先阅读全部内容'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  disclaimerText: {
    fontSize: 14,
    lineHeight: 24,
    color: '#374151',
  },
  scrollHint: {
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#fef3c7',
  },
  scrollHintText: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '500',
  },
  bottomBar: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  agreeBtn: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#EC4141',
    justifyContent: 'center',
    alignItems: 'center',
  },
  agreeBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  agreeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  agreeBtnTextDisabled: {
    color: '#94a3b8',
  },
})
