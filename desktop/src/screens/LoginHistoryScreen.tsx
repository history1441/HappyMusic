import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Check, X, MapPin, Monitor, Clock, Loader2 } from 'lucide-react'
import api from '@common/services/api'

interface LoginRecord {
  id: number
  action: string
  success: boolean
  ip: string
  user_agent: string
  created_at: string
}

interface ParsedUA {
  os: string
  device: string
  browser: string
}

function parseUA(ua: string): ParsedUA {
  let os = '未知系统'
  let device = '未知设备'
  let browser = '未知浏览器'

  if (!ua) return { os, device, browser }

  if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s([\d.]+)/)
    os = match ? `Android ${match[1]}` : 'Android'
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const match = ua.match(/OS\s([\d_]+)/)
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS'
  } else if (/Windows/i.test(ua)) {
    os = 'Windows'
  } else if (/Mac OS X/i.test(ua)) {
    os = 'macOS'
  } else if (/Linux/i.test(ua)) {
    os = 'Linux'
  }

  if (/Expo/i.test(ua)) {
    device = 'Expo Go'
  } else if (/iPhone/i.test(ua)) {
    device = 'iPhone'
  } else if (/iPad/i.test(ua)) {
    device = 'iPad'
  } else if (/Android/i.test(ua)) {
    device = 'Android 手机'
  } else if (/Windows/i.test(ua)) {
    device = 'PC'
  } else if (/Mac/i.test(ua)) {
    device = 'Mac'
  }

  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) {
    browser = 'Chrome'
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari'
  } else if (/Firefox/i.test(ua)) {
    browser = 'Firefox'
  } else if (/Edge/i.test(ua)) {
    browser = 'Edge'
  } else if (/Expo/i.test(ua)) {
    browser = 'Expo'
  }

  return { os, device, browser }
}

function getActionLabel(action: string): string {
  switch (action) {
    case 'password_login':
    case 'login':
      return '密码登录'
    case 'qrcode_login':
    case 'scan_login':
      return '扫码登录'
    case 'qrcode_confirm':
    case 'scan_confirm':
      return '扫码确认'
    case 'token_refresh':
      return '令牌刷新'
    case 'register':
      return '注册'
    default:
      return action || '登录'
  }
}

function formatTimestamp(ts: string): string {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

export default function LoginHistoryScreen() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<LoginRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const { data } = await api.get('/auth/login-history')
      setRecords(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load login history:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1 text-text hover:text-primary transition-colors">
          <ArrowLeft size={22} />
        </button>
        <span className="text-lg font-bold">登录历史</span>
        <div className="w-6" />
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {records.length > 0 ? (
            records.map((item) => {
              const ua = parseUA(item.user_agent)
              return (
                <div
                  key={item.id}
                  className="flex px-4 py-3.5 bg-card border-b border-border-light"
                >
                  {/* Status icon */}
                  <div className="mr-3 flex items-center">
                    {item.success ? (
                      <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
                        <X size={14} className="text-white" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          item.success
                            ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                            : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {getActionLabel(item.action)}
                      </span>
                      <span className="text-xs text-text-tertiary">{formatTimestamp(item.created_at)}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} className="text-text-tertiary flex-shrink-0" />
                        <span className="text-xs text-text-secondary">IP: {item.ip || '未知'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Monitor size={12} className="text-text-tertiary flex-shrink-0" />
                        <span className="text-xs text-text-secondary">
                          {ua.os} · {ua.device} · {ua.browser}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="flex flex-col items-center justify-center pt-20">
              <Clock size={56} className="text-border" />
              <p className="text-sm text-text-tertiary mt-3">暂无登录记录</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
