import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'
import { useIsMobile } from '../hooks/useBreakpoint'
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts'
import { useSync } from '../hooks/useSync'
import MiniPlayer from './player/MiniPlayer'
import FullPlayer from './player/FullPlayer'
import { useComfortStore } from '../stores/comfortStore'
import {
  Search, ListMusic, Moon, Sun, LogOut, Music, Clock,
  BarChart3, Flame, Radio, Gamepad2, Sparkles, MoreHorizontal,
  FolderOpen, Scissors, ChevronDown, KeyRound, Eye, EyeOff, X, Shield,
  User, Music2, Mic, Settings,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import api from '../services/api'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const { isDark, toggle } = useThemeStore()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()
  const [showMore, setShowMore] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [pwdForm, setPwdForm] = useState({ old: '', new: '', confirm: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const comfortEnabled = useComfortStore((s) => s.enabled)
  const setComfortEnabled = useComfortStore((s) => s.setEnabled)
  const comfortInit = useComfortStore((s) => s.init)
  const userMenuRef = useRef<HTMLDivElement>(null)
  useKeyboardShortcuts()
  useSync()

  useEffect(() => { comfortInit() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChangePassword = async () => {
    if (!pwdForm.old || !pwdForm.new) { setPwdError('请填写完整'); return }
    if (pwdForm.new.length < 6) { setPwdError('新密码至少6位'); return }
    if (pwdForm.new !== pwdForm.confirm) { setPwdError('两次密码不一致'); return }
    setPwdLoading(true)
    setPwdError('')
    try {
      await api.put('/auth/change-password', { old_password: pwdForm.old, new_password: pwdForm.new })
      setShowPwdModal(false)
      setPwdForm({ old: '', new: '', confirm: '' })
      alert('密码修改成功')
    } catch (e: any) {
      setPwdError(e.response?.data?.detail || '修改失败')
    } finally {
      setPwdLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const mainNav = [
    { to: '/', icon: Search, label: '搜索' },
    { to: '/playlists', icon: ListMusic, label: '歌单' },
    { to: '/recent', icon: Clock, label: '最近' },
    { to: '/hot', icon: Flame, label: '热搜' },
    { to: '/mood', icon: Radio, label: '电台' },
    { to: '/guess', icon: Gamepad2, label: '猜歌' },
    { to: '/recommend', icon: Sparkles, label: 'AI推荐' },
    { to: '/stats', icon: BarChart3, label: '统计' },
  ]

  const moreNav = [
    { to: '/local', icon: FolderOpen, label: '本地音乐' },
    { to: '/ringtone', icon: Scissors, label: '铃声裁剪' },
    { to: '/login-history', icon: Shield, label: '登录记录' },
    { to: '/download', icon: Music, label: '下载APP' },
  ]

  // Mobile bottom tab nav (5 items max)
  const mobileTabs = [
    { to: '/', icon: Search, label: '搜索' },
    { to: '/playlists', icon: ListMusic, label: '歌单' },
    { to: '/recommend', icon: Sparkles, label: '发现' },
    { to: '/hot', icon: Flame, label: '热搜' },
    { to: '/stats', icon: User, label: '我的' },
  ]

  // ====== MOBILE LAYOUT ======
  if (isMobile) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile top bar */}
        <header style={{
          height: 48, display: 'flex', alignItems: 'center',
          padding: '0 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-primary)', flexShrink: 0, position: 'relative', zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Music size={14} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>HappyMusic</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={toggle} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: 6,
            }}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowUserMenu(!showUserMenu)} style={{
                padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
              }}>
                <User size={14} />
                <ChevronDown size={12} />
              </button>
              {showUserMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)',
                  zIndex: 200, minWidth: 150,
                }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
                    {user?.nickname || user?.username}
                  </div>
                  {/* Mobile: show all nav items in user menu */}
                  {mainNav.slice(2).concat(moreNav).map(({ to, icon: Icon, label }) => (
                    <NavLink key={to} to={to} onClick={() => setShowUserMenu(false)}
                      style={({ isActive }) => ({
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px', fontSize: 13,
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                        textDecoration: 'none',
                      })}
                    >
                      <Icon size={14} /> {label}
                    </NavLink>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => { setShowUserMenu(false); setShowSettings(true) }} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', fontSize: 13, width: '100%',
                      color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer',
                    }}>
                      <Settings size={14} /> 设置
                    </button>
                    <NavLink to="/settings/sources" onClick={() => setShowUserMenu(false)} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', fontSize: 13,
                      color: 'var(--text-secondary)', textDecoration: 'none',
                    }}>
                      <Music2 size={14} /> 音乐源管理
                    </NavLink>
                    <button onClick={() => { setShowUserMenu(false); setShowPwdModal(true) }} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', fontSize: 13, width: '100%',
                      color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer',
                    }}>
                      <KeyRound size={14} /> 修改密码
                    </button>
                    <button onClick={() => { setShowUserMenu(false); handleLogout() }} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', fontSize: 13, width: '100%',
                      color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer',
                    }}>
                      <LogOut size={14} /> 退出登录
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>

        <MiniPlayer />
        <FullPlayer />

        {/* Mobile bottom tab bar */}
        <nav style={{
          display: 'flex', height: 52, background: 'var(--bg-primary)',
          borderTop: '1px solid var(--border)', flexShrink: 0,
        }}>
          {mobileTabs.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                textDecoration: 'none', fontSize: 10, fontWeight: isActive ? 600 : 400,
              })}
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Password modal */}
        {showPwdModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: 16,
          }}>
            <div style={{
              width: '100%', maxWidth: 380, padding: 24, background: 'var(--card)',
              borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>修改密码</h3>
                <button onClick={() => setShowPwdModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input type="password" placeholder="旧密码" value={pwdForm.old} onChange={e => setPwdForm(f => ({ ...f, old: e.target.value }))}
                  style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box', width: '100%' }} />
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} placeholder="新密码（至少6位）" value={pwdForm.new} onChange={e => setPwdForm(f => ({ ...f, new: e.target.value }))}
                    style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box', width: '100%' }} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <input type="password" placeholder="确认新密码" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))}
                  style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box', width: '100%' }} />
                {pwdError && <div style={{ color: '#ef4444', fontSize: 12 }}>{pwdError}</div>}
                <button onClick={handleChangePassword} disabled={pwdLoading} style={{
                  padding: '10px', background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 'var(--radius-sm)', cursor: pwdLoading ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 600, opacity: pwdLoading ? 0.7 : 1,
                }}>
                  {pwdLoading ? '提交中...' : '确认修改'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings modal */}
        {showSettings && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: 16,
          }}>
            <div style={{
              width: '100%', maxWidth: 380, padding: 24, background: 'var(--card)',
              borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Settings size={18} /> 设置
                </h3>
                <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Mic size={18} style={{ color: 'var(--accent)' }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>AI 语音关怀</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>播放时随机播报温暖语音</div>
                    </div>
                  </div>
                  <button onClick={() => setComfortEnabled(!comfortEnabled)} style={{
                    width: 48, height: 26, borderRadius: 13,
                    background: comfortEnabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                    border: 'none', cursor: 'pointer', position: 'relative',
                    transition: 'background 0.2s',
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 3,
                      left: comfortEnabled ? 25 : 3,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, padding: '0 4px' }}>
                  开启后，每播放若干首歌曲后会触发一次 AI 生成的安慰语音，使用浏览器语音合成播报。
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ====== DESKTOP LAYOUT (unchanged) ======
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        height: 56, display: 'flex', alignItems: 'center',
        padding: '0 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-primary)', flexShrink: 0, position: 'relative', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Music size={16} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18 }}>HappyMusic</span>
        </div>

        <nav style={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden' }}>
          {mainNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                fontSize: 13, fontWeight: 500,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-light)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              })}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}

          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMore(!showMore)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 'var(--radius-sm)',
              fontSize: 13, fontWeight: 500,
              color: moreNav.some(n => location.pathname === n.to) ? 'var(--accent)' : 'var(--text-secondary)',
              background: 'transparent', border: 'none', cursor: 'pointer',
            }}>
              <MoreHorizontal size={15} />
              更多
              <ChevronDown size={12} />
            </button>
            {showMore && (
              <div style={{
                position: 'absolute', top: '100%', left: 0,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', marginTop: 4,
                boxShadow: 'var(--shadow-lg)', zIndex: 100, minWidth: 140,
              }}>
                {moreNav.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} onClick={() => setShowMore(false)}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', fontSize: 13,
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      textDecoration: 'none',
                    })}
                  >
                    <Icon size={15} />
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={toggle} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', padding: 6,
            borderRadius: 'var(--radius-sm)',
          }}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowUserMenu(!showUserMenu)} style={{
              padding: '4px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-secondary)', fontSize: 13,
              color: 'var(--text-secondary)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {user?.nickname || user?.username}
              <ChevronDown size={12} />
            </button>
            {showUserMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)',
                zIndex: 200, minWidth: 140,
              }}>
                <button onClick={() => { setShowUserMenu(false); setShowSettings(true) }} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', fontSize: 13, width: '100%',
                  color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer',
                }}>
                  <Settings size={14} /> 设置
                </button>
                <NavLink to="/settings/sources" onClick={() => setShowUserMenu(false)} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', fontSize: 13,
                  color: 'var(--text-secondary)', textDecoration: 'none',
                }}>
                  <Music2 size={14} /> 音乐源管理
                </NavLink>
                <button onClick={() => { setShowUserMenu(false); setShowPwdModal(true) }} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', fontSize: 13, width: '100%',
                  color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer',
                }}>
                  <KeyRound size={14} /> 修改密码
                </button>
                <button onClick={() => { setShowUserMenu(false); handleLogout() }} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', fontSize: 13, width: '100%',
                  color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer',
                  borderTop: '1px solid var(--border)',
                }}>
                  <LogOut size={14} /> 退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>

      <MiniPlayer />
      <FullPlayer />

      {showPwdModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            width: 380, padding: 24, background: 'var(--card)',
            borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>修改密码</h3>
              <button onClick={() => setShowPwdModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="password" placeholder="旧密码" value={pwdForm.old} onChange={e => setPwdForm(f => ({ ...f, old: e.target.value }))}
                style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box', width: '100%' }} />
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} placeholder="新密码（至少6位）" value={pwdForm.new} onChange={e => setPwdForm(f => ({ ...f, new: e.target.value }))}
                  style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box', width: '100%' }} />
                <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <input type="password" placeholder="确认新密码" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))}
                style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box', width: '100%' }} />
              {pwdError && <div style={{ color: '#ef4444', fontSize: 12 }}>{pwdError}</div>}
              <button onClick={handleChangePassword} disabled={pwdLoading} style={{
                padding: '10px', background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 'var(--radius-sm)', cursor: pwdLoading ? 'not-allowed' : 'pointer',
                fontSize: 14, fontWeight: 600, opacity: pwdLoading ? 0.7 : 1,
              }}>
                {pwdLoading ? '提交中...' : '确认修改'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            width: 380, padding: 24, background: 'var(--card)',
            borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={18} /> 设置
              </h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Mic size={18} style={{ color: 'var(--accent)' }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>AI 语音关怀</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>播放时随机播报温暖语音</div>
                  </div>
                </div>
                <button onClick={() => setComfortEnabled(!comfortEnabled)} style={{
                  width: 48, height: 26, borderRadius: 13,
                  background: comfortEnabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background 0.2s',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3,
                    left: comfortEnabled ? 25 : 3,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, padding: '0 4px' }}>
                开启后，每播放若干首歌曲后会触发一次 AI 生成的安慰语音，使用浏览器语音合成播报。
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
