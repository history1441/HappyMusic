import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { desktopStorage } from '../adapters/storage'

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

使用本应用即表示您已阅读、理解并同意遵守以上所有条款。`

export default function DisclaimerScreen() {
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 20) {
        setScrolledToBottom(true)
      }
    }
    el.addEventListener('scroll', handler)
    return () => el.removeEventListener('scroll', handler)
  }, [])

  const handleAgree = async () => {
    await desktopStorage.setItem('disclaimer_accepted', JSON.stringify({ agreed: true, agreedAt: new Date().toISOString() }))
    navigate('/', { replace: true })
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="px-6 py-4 border-b border-border bg-card">
        <h2 className="text-lg font-bold text-text">用户使用协议</h2>
        <p className="text-sm text-text-tertiary mt-1">请仔细阅读以下内容后继续</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        <pre className="whitespace-pre-wrap text-sm text-text-secondary leading-relaxed font-sans">{DISCLAIMER_TEXT}</pre>
      </div>

      {!scrolledToBottom && (
        <div className="px-6 py-2 bg-yellow-50 text-center">
          <span className="text-xs text-yellow-600 font-medium">请向下滚动阅读全部内容</span>
        </div>
      )}

      <div className="px-6 py-4 border-t border-border bg-card">
        <button
          onClick={handleAgree}
          disabled={!scrolledToBottom}
          className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${scrolledToBottom ? 'bg-primary text-white hover:bg-primary/90' : 'bg-border text-text-tertiary cursor-not-allowed'}`}
        >
          {scrolledToBottom ? '我已阅读并同意' : '请先阅读全部内容'}
        </button>
      </div>
    </div>
  )
}
