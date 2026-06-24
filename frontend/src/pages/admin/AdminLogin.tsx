import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuthStore } from '../../stores/adminAuthStore'
import { Lock, User } from 'lucide-react'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { adminLogin } = useAdminAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const ok = await adminLogin(username, password)
    setLoading(false)
    if (ok) {
      navigate('/admin')
    } else {
      setError('登录失败，请检查用户名密码和管理员权限')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <form onSubmit={handleSubmit} style={{
        width: 380, padding: 40, background: 'var(--card)',
        borderRadius: 'var(--radius)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>HappyMusic</h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>管理后台登录</p>
        </div>
        {error && (
          <div style={{
            padding: '10px 14px', marginBottom: 16, borderRadius: 'var(--radius-sm)',
            background: '#ff444420', color: '#ff4444', fontSize: 13,
          }}>{error}</div>
        )}
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <User size={16} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)',
          }} />
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="管理员用户名" required
            style={{
              width: '100%', padding: '12px 12px 12px 38px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
              fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }} />
        </div>
        <div style={{ marginBottom: 24, position: 'relative' }}>
          <Lock size={16} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)',
          }} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="密码" required
            style={{
              width: '100%', padding: '12px 12px 12px 38px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
              fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }} />
        </div>
        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '12px', background: 'var(--accent)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-sm)', cursor: loading ? 'wait' : 'pointer',
          fontWeight: 600, fontSize: 14, opacity: loading ? 0.7 : 1,
        }}>
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  )
}
