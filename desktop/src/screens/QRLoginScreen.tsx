import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { QRCodeSVG } from 'qrcode.react'
import api, { setTokenCache, initTokenCache } from '@common/services/api'
import { RefreshCw, ArrowLeft, CheckCircle, XCircle, QrCode } from 'lucide-react'
import { cn } from '../utils/cn'

type QRStatus = 'loading' | 'pending' | 'scanned' | 'confirmed' | 'expired' | 'error'

interface QRCodeData {
  code: string
  url: string
  expires_in: number
}

export default function QRLoginScreen() {
  const navigate = useNavigate()
  const [qrData, setQRData] = useState<QRCodeData | null>(null)
  const [status, setStatus] = useState<QRStatus>('loading')
  const [scannedUsername, setScannedUsername] = useState('')
  const [countdown, setCountdown] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const generateQR = useCallback(async () => {
    setStatus('loading')
    setQRData(null)
    setScannedUsername('')

    try {
      const { data } = await api.post('/qrcode/generate')
      setQRData(data)
      setCountdown(data.expires_in)
      setStatus('pending')
      startPolling(data.code)
      startCountdown(data.expires_in)
    } catch {
      setStatus('error')
    }
  }, [])

  const startPolling = (code: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get('/qrcode/status', { params: { code } })
        switch (data.status) {
          case 'pending':
            break
          case 'scanned':
            setStatus('scanned')
            setScannedUsername(data.username || '')
            break
          case 'confirmed':
            setStatus('confirmed')
            await setTokenCache(data.access_token, data.refresh_token)
            await initTokenCache()
            stopPolling()
            setTimeout(() => navigate('/', { replace: true }), 1000)
            break
          case 'expired':
            setStatus('expired')
            stopPolling()
            break
          case 'cancelled':
            setStatus('expired')
            stopPolling()
            break
        }
      } catch {
        // Continue polling
      }
    }, 1500)
  }

  const startCountdown = (expiresIn: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current)

    // Use server expiry time as the source of truth
    const expiryTime = Date.now() + expiresIn * 1000

    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000))
      setCountdown(remaining)

      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current)
        countdownRef.current = null
        setStatus('expired')
        stopPolling()
      }
    }, 1000)
  }

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }

  useEffect(() => {
    generateQR()
    return () => stopPolling()
  }, [generateQR])

  return (
    <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-sm">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate('/login')}
          className="p-1 text-text-secondary hover:text-text transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-bold">扫码登录</h2>
      </div>

      {/* QR Code area */}
      <div className="flex flex-col items-center">
        <div className={cn(
          'w-56 h-56 rounded-xl flex items-center justify-center relative mb-4',
          status === 'confirmed' ? 'bg-success/10' : 'bg-white'
        )}>
          {status === 'loading' && (
            <div className="spinner w-10 h-10" />
          )}
          {status === 'pending' && qrData && (
            <QRCodeSVG
              value={qrData.url}
              size={200}
              level="M"
              fgColor="#1e293b"
            />
          )}
          {status === 'scanned' && qrData && (
            <QRCodeSVG
              value={qrData.url}
              size={200}
              level="M"
              fgColor="#94a3b8"
            />
          )}
          {status === 'confirmed' && (
            <CheckCircle size={64} className="text-success" />
          )}
          {(status === 'expired' || status === 'error') && (
            <div className="flex flex-col items-center gap-2">
              <XCircle size={48} className="text-danger" />
              <span className="text-sm text-danger">
                {status === 'expired' ? '二维码已过期' : '生成失败'}
              </span>
            </div>
          )}
        </div>

        {/* Status text */}
        <div className="text-center mb-4">
          {status === 'pending' && countdown > 0 && (
            <p className="text-sm text-text-secondary">
              请使用移动端扫描二维码 ({countdown}s)
            </p>
          )}
          {status === 'scanned' && (
            <div className="text-sm">
              <p className="text-success font-medium">扫描成功</p>
              <p className="text-text-secondary mt-1">
                用户 {scannedUsername} 已扫描，请在手机上确认登录
              </p>
            </div>
          )}
          {status === 'confirmed' && (
            <p className="text-sm text-success font-medium">登录成功，正在跳转...</p>
          )}
        </div>

        {/* Refresh button */}
        {(status === 'expired' || status === 'error') && (
          <button
            onClick={generateQR}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            <RefreshCw size={16} />
            刷新二维码
          </button>
        )}
      </div>

      {/* Instruction */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-start gap-3 text-xs text-text-tertiary">
          <QrCode size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p>打开 HappyMusic 移动端</p>
            <p>扫描上方二维码即可登录桌面版</p>
          </div>
        </div>
      </div>
    </div>
  )
}
