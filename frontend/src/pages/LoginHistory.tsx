import { useEffect, useState } from 'react'
import api from '../services/api'
import { Clock, Monitor, Globe, Shield, CheckCircle, XCircle } from 'lucide-react'

function parseUA(ua: string) {
  if (!ua) return { browser: '未知', os: '未知' }
  let browser = '未知'
  let os = '未知'
  if (ua.includes('Firefox/')) browser = 'Firefox'
  else if (ua.includes('Edg/')) browser = 'Edge'
  else if (ua.includes('Chrome/')) browser = 'Chrome'
  else if (ua.includes('Safari/')) browser = 'Safari'
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
  return { browser, os }
}

const ACTION_MAP: Record<string, string> = {
  login: '密码登录',
  admin_login: '管理员登录',
  qrcode_scan: '扫码登录',
  qrcode_login: '扫码确认',
}

export default function LoginHistory() {
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    api.get('/auth/login-history').then(({ data }) => {
      setLogs(data.logs || [])
    }).catch(() => {})
  }, [])

  return (
    <div style={{ padding: '0 24px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Shield size={22} style={{ color: 'var(--accent)' }} />
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>登录记录</h2>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 8 }}>最近 50 条</span>
      </div>

      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          <Clock size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p>暂无登录记录</p>
        </div>
      ) : (
        <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          {logs.map((l, i) => {
            const { browser, os } = parseUA(l.user_agent || '')
            return (
              <div key={l.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 16px',
                borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none',
                background: l.success ? 'transparent' : '#ef444408',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: l.success ? '#10b98115' : '#ef444415',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {l.success ? <CheckCircle size={16} style={{ color: '#10b981' }} /> : <XCircle size={16} style={{ color: '#ef4444' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{ACTION_MAP[l.action] || l.action}</span>
                    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 8, background: l.success ? '#10b98120' : '#ef444420', color: l.success ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                      {l.success ? '成功' : '失败'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Globe size={11} /> {l.ip_address || '-'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Monitor size={11} /> {browser} / {os}</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right', flexShrink: 0, width: 140 }}>
                  {l.created_at ? new Date(l.created_at).toLocaleString() : '-'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
