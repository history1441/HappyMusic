import { useState } from 'react'
import { useNavigate } from 'react-router'
import api, { setTokenCache, initTokenCache } from '@common/services/api'
import { desktopStorage } from '../adapters/storage'

const DISCLAIMER_TEXT = `免责声明 / 用户使用协议

一、应用性质
HappyMusic 是一款基于开源技术构建的个人音乐播放与管理应用，仅供个人学习、研究及非商业用途使用。

二、音乐来源说明
本应用中搜索、试听及下载的音乐内容均来源于第三方开源库 musicdl。本应用本身不存储、不缓存、不分发任何音乐文件。

三、版权声明
1. 本应用不拥有任何通过 musicdl 获取的音乐内容的版权。
2. 所有音乐内容的版权归属于原版权持有者。
3. 用户在使用本应用时，应自行确保其行为符合所在国家/地区的版权法律法规。

四、用户责任
1. 用户不得将本应用及通过本应用获取的任何音乐内容用于商业用途。
2. 通过本应用下载的音乐文件，建议用户在 24 小时内删除。
3. 用户因使用本应用而产生的任何法律责任，由用户自行承担。

五、免责条款
1. 本应用不对 musicdl 库所获取的音乐内容的合法性作任何保证。
2. 本应用不对因使用本应用而导致的任何直接或间接损失承担责任。
3. 使用本应用即表示您已阅读、理解并同意遵守以上所有条款。`

export default function LoginScreen() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isRegister) {
        await api.post('/auth/register', { username, password })
        setError('注册成功，请登录')
        setIsRegister(false)
      } else {
        const { data } = await api.post('/auth/login', { username, password })
        await setTokenCache(data.access_token, data.refresh_token)
        await initTokenCache()
        navigate('/', { replace: true })
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || (isRegister ? '注册失败' : '登录失败'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-card rounded-xl shadow-lg p-8">
      <h2 className="text-xl font-bold text-center mb-6">
        {isRegister ? '注册账号' : '登录 HappyMusic'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-lg bg-bg text-sm focus:outline-none focus:border-primary transition-colors"
            autoFocus
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-lg bg-bg text-sm focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {error && (
          <p className={`text-sm ${error.includes('成功') ? 'text-success' : 'text-danger'}`}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full py-2.5 bg-primary text-white rounded-lg font-medium text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {loading ? <span className="spinner mx-auto" /> : isRegister ? '注册' : '登录'}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          onClick={() => { setIsRegister(!isRegister); setError('') }}
          className="text-text-secondary hover:text-primary transition-colors"
        >
          {isRegister ? '已有账号？登录' : '没有账号？注册'}
        </button>
        <button
          onClick={() => navigate('/qr-login')}
          className="text-primary hover:underline"
        >
          扫码登录
        </button>
      </div>

      <div className="mt-4 text-center">
        <button onClick={() => setShowDisclaimer(true)} className="text-xs text-text-tertiary hover:text-text-secondary hover:underline">
          用户使用协议
        </button>
      </div>

      {showDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDisclaimer(false)}>
          <div className="bg-card rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-base font-bold text-text">用户使用协议</h3>
              <button onClick={() => setShowDisclaimer(false)} className="text-text-tertiary hover:text-text">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="whitespace-pre-wrap text-sm text-text-secondary leading-relaxed font-sans">{DISCLAIMER_TEXT}</pre>
            </div>
            <div className="px-5 py-3 border-t border-border">
              <button onClick={() => setShowDisclaimer(false)} className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium">知道了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
