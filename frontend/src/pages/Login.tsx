import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useNavigate } from 'react-router-dom'
import { Music, Eye, EyeOff, QrCode, Smartphone, CheckCircle, XCircle, Loader } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import api from '../services/api'

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrStatus, setQrStatus] = useState<'loading' | 'pending' | 'scanned' | 'confirmed' | 'expired'>('loading')
  const [qrUsername, setQrUsername] = useState('')
  const [countdown, setCountdown] = useState(60)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { login, register, setTokens } = useAuthStore()
  const navigate = useNavigate()

  const cleanupQR = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const generateQR = useCallback(async () => {
    cleanupQR()
    setQrStatus('loading')
    setCountdown(60)
    try {
      const { data } = await api.post('/qrcode/generate')
      setQrCode(data.url)
      setQrStatus('pending')

      // HTTP 轮询作为主通道（比 WebSocket 更可靠）
      let pollCount = 0
      const code = data.code
      timerRef.current = setInterval(async () => {
        pollCount++
        if (pollCount > 120) { setQrStatus('expired'); cleanupQR(); return }
        try {
          const { data: status } = await api.get(`/qrcode/status?code=${code}`)
          if (status.status === 'scanned') { setQrStatus('scanned'); setQrUsername(status.username || '') }
          else if (status.status === 'confirmed') {
            setQrStatus('confirmed')
            try {
              await setTokens(status.access_token, status.refresh_token)
              cleanupQR()
              navigate('/')
            } catch {
              setError('登录失败，请重试')
              cleanupQR()
            }
          } else if (status.status === 'expired' || status.status === 'cancelled') {
            setQrStatus('expired'); cleanupQR()
          }
        } catch { /* ignore single poll error */ }
      }, 1000)
    } catch {
      setError('生成二维码失败')
    }
  }, [cleanupQR, navigate, setTokens])

  // 倒计时
  useEffect(() => {
    if (showQR && qrStatus === 'pending') {
      timerRef.current = setInterval(() => {
        setCountdown(c => { if (c <= 1) { setQrStatus('expired'); cleanupQR(); return 0 } return c - 1 })
      }, 1000)
      return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }
  }, [showQR, qrStatus, cleanupQR])

  useEffect(() => { return cleanupQR }, [cleanupQR])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isRegister) {
        await register(username, password)
      } else {
        await login(username, password)
      }
      navigate('/')
    } catch (err: any) {
      const msg = err.response?.data?.detail || '操作失败，请重试'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: '48px 32px',
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'var(--accent)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Music size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
            HappyMusic
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14 }}>
            {showQR ? '扫码登录' : isRegister ? '创建账号，开始听歌' : '登录你的账号'}
          </p>
        </div>

        {showQR ? (
          <div style={{ textAlign: 'center' }}>
            {qrStatus === 'loading' && (
              <div style={{ padding: '60px 0 40px' }}>
                <div style={{
                  width: 56, height: 56, margin: '0 auto 16px',
                  borderRadius: '50%', background: 'var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Loader size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>正在生成二维码...</div>
              </div>
            )}

            {qrStatus === 'pending' && qrCode && (
              <div>
                <div style={{
                  display: 'inline-block', padding: 20, background: '#fff',
                  borderRadius: 16, marginBottom: 20,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                }}>
                  <QRCodeSVG value={qrCode} size={192} level="M" />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  扫码登录
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                  打开 <strong style={{ color: 'var(--accent)' }}>HappyMusic APP</strong> 扫描二维码
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 20,
                  background: countdown <= 10 ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)',
                  fontSize: 12, color: countdown <= 10 ? '#ef4444' : 'var(--text-tertiary)',
                  transition: 'all 0.3s',
                }}>
                  <span style={{ fontSize: 14 }}>⏱</span>
                  <span>{countdown} 秒后过期</span>
                </div>
                <div style={{
                  marginTop: 16, display: 'flex', justifyContent: 'center',
                  alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: 12,
                }}>
                  <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> 等待手机扫码
                </div>
              </div>
            )}

            {qrStatus === 'scanned' && (
              <div style={{ padding: '32px 0 24px' }}>
                <div style={{
                  width: 72, height: 72, margin: '0 auto 16px',
                  borderRadius: '50%', background: 'rgba(59,130,246,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Smartphone size={36} style={{ color: '#3b82f6' }} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  扫描成功
                </div>
                <div style={{
                  display: 'inline-block', padding: '6px 16px', borderRadius: 20,
                  background: 'rgba(59,130,246,0.08)', fontSize: 13, color: 'var(--text-secondary)',
                  marginBottom: 16,
                }}>
                  用户 <strong style={{ color: '#3b82f6' }}>{qrUsername}</strong>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
                  color: 'var(--accent)', fontSize: 14, fontWeight: 500,
                }}>
                  <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  请在手机上确认登录
                </div>
              </div>
            )}

            {qrStatus === 'confirmed' && (
              <div style={{ padding: '32px 0 24px' }}>
                <div style={{
                  width: 72, height: 72, margin: '0 auto 16px',
                  borderRadius: '50%', background: 'rgba(16,185,129,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckCircle size={36} style={{ color: '#10b981' }} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#10b981', marginBottom: 6 }}>登录成功</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>正在进入...</div>
              </div>
            )}

            {qrStatus === 'expired' && (
              <div style={{ padding: '32px 0 24px' }}>
                <div style={{
                  width: 72, height: 72, margin: '0 auto 16px',
                  borderRadius: '50%', background: 'rgba(239,68,68,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <XCircle size={36} style={{ color: '#ef4444' }} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  二维码已过期
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
                  请重新获取二维码
                </div>
                <button onClick={generateQR} style={{
                  padding: '10px 32px', background: 'var(--accent)', border: 'none',
                  borderRadius: 20, color: '#fff', cursor: 'pointer', fontSize: 14,
                  fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  transition: 'opacity 0.2s',
                }}>刷新二维码</button>
              </div>
            )}

            <div style={{
              marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'center',
            }}>
              <button onClick={() => { setShowQR(false); cleanupQR() }} style={{
                background: 'none', border: 'none', color: 'var(--text-tertiary)',
                cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
                transition: 'color 0.2s',
              }}>
                ← 账号密码登录
              </button>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required minLength={3}
                  style={{
                    width: '100%', padding: '12px 16px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: 15,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ marginBottom: 24, position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required minLength={6}
                  autoComplete="off"
                  data-1p-ignore
                  style={{
                    width: '100%', padding: '12px 16px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: 15,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && (
                <div style={{
                  padding: '10px 16px', marginBottom: 16,
                  background: 'rgba(252,60,68,0.1)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fc3c44', fontSize: 13,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '12px',
                  background: 'var(--accent)',
                  color: '#fff', fontWeight: 600,
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: 15,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? '处理中...' : (isRegister ? '注册' : '登录')}
              </button>
            </form>

            {/* 扫码登录按钮 */}
            {!isRegister && (
              <div style={{ marginTop: 16 }}>
                <button onClick={() => { setShowQR(true); generateQR() }} style={{
                  width: '100%', padding: '10px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', fontSize: 13,
                  color: 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <QrCode size={16} /> 扫码登录
                </button>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button
                onClick={() => { setIsRegister(!isRegister); setError('') }}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--accent)', cursor: 'pointer', fontSize: 14,
                }}
              >
                {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <a href="/download" style={{ color: 'var(--text-tertiary)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Smartphone size={14} /> 下载 HappyMusic APP
              </a>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
