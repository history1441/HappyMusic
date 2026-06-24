import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAdminAuthStore } from '../../stores/adminAuthStore'
import { LayoutDashboard, Users, BarChart3, Server, Settings, Database, FileText, Package, Activity, Megaphone, LogOut, Shield, Music } from 'lucide-react'

const NAV = [
  { to: '/admin', icon: LayoutDashboard, label: '仪表盘', end: true },
  { to: '/admin/users', icon: Users, label: '用户管理' },
  { to: '/admin/analytics', icon: BarChart3, label: '数据分析' },
  { to: '/admin/audit', icon: Shield, label: '审计日志' },
  { to: '/admin/sources', icon: Music, label: '音乐源管理' },
  { to: '/admin/system', icon: Server, label: '系统监控' },
  { to: '/admin/config', icon: Settings, label: '配置管理' },
  { to: '/admin/cache', icon: Database, label: '缓存管理' },
  { to: '/admin/logs', icon: FileText, label: '日志查看' },
  { to: '/admin/builds', icon: Package, label: '应用发布' },
  { to: '/admin/monitor', icon: Activity, label: 'API监控' },
  { to: '/admin/announcements', icon: Megaphone, label: '公告管理' },
  { to: '/admin/database', icon: Database, label: '数据库' },
]

export default function AdminLayout() {
  const { adminLogout, adminUser } = useAdminAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    adminLogout()
    navigate('/admin/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <aside style={{
        width: 220, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0,
      }}>
        <div style={{
          padding: '20px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <LayoutDashboard size={20} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>HappyMusic Admin</span>
        </div>
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', fontSize: 13, textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: isActive ? 'var(--accent-light)' : 'transparent',
              borderRight: isActive ? '2px solid var(--accent)' : 'none',
            })}>
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
            {adminUser?.username || 'Admin'} ({adminUser?.role || 'admin'})
          </div>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', fontSize: 12, padding: 0,
          }}>
            <LogOut size={14} /> 退出
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, marginLeft: 220, padding: '24px 32px', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
