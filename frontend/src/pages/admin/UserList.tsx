import { useEffect, useState } from 'react'
import adminApi from '../../services/adminApi'
import { Search, Ban, CheckCircle, Trash2, ChevronLeft, ChevronRight, Plus, KeyRound, X, Clock, AlertTriangle } from 'lucide-react'

export default function UserList() {
  const [users, setUsers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showReset, setShowReset] = useState<number | null>(null)
  const [addForm, setAddForm] = useState({ username: '', password: '', nickname: '', role: 'user' })
  const [newPwd, setNewPwd] = useState('')
  const [msg, setMsg] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const pageSize = 20

  const fetchUsers = async (p = page, s = search) => {
    const { data } = await adminApi.get('/users', { params: { page: p, page_size: pageSize, search: s } })
    setUsers(data.users); setTotal(data.total); setSelectedIds(new Set())
  }

  useEffect(() => { fetchUsers() }, [page])
  const handleSearch = () => { setPage(1); fetchUsers(1, search) }

  const handleBan = async (id: number, isActive: boolean) => {
    if (isActive) {
      if (!confirm('确认封禁此用户？')) return
      await adminApi.put(`/users/${id}/ban`)
    } else {
      await adminApi.put(`/users/${id}/activate`)
    }
    fetchUsers()
  }
  const handleDelete = async (id: number) => {
    if (!confirm('确认删除此用户？此操作不可恢复')) return
    await adminApi.delete(`/users/${id}`); fetchUsers()
  }
  const handleAdd = async () => {
    try {
      await adminApi.post('/users', addForm)
      setMsg('用户创建成功'); setShowAdd(false)
      setAddForm({ username: '', password: '', nickname: '', role: 'user' }); fetchUsers()
    } catch (e: any) { setMsg(e.response?.data?.detail || '创建失败') }
    setTimeout(() => setMsg(''), 3000)
  }
  const handleResetPwd = async (id: number) => {
    try {
      await adminApi.put(`/users/${id}/reset-password`, { new_password: newPwd })
      setMsg('密码重置成功'); setShowReset(null); setNewPwd('')
    } catch (e: any) { setMsg(e.response?.data?.detail || '重置失败') }
    setTimeout(() => setMsg(''), 3000)
  }
  const handleRoleChange = async (id: number, role: string) => {
    await adminApi.put(`/users/${id}/role`, { role }); fetchUsers()
  }

  // 批量操作
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(users.map(u => u.id)))
    }
  }
  const handleBatchBan = async () => {
    const ids = Array.from(selectedIds)
    if (!confirm(`确认批量封禁 ${ids.length} 个用户？`)) return
    try {
      const { data } = await adminApi.put('/users/batch/ban', { user_ids: ids })
      setMsg(`已封禁 ${data.affected} 个用户`); fetchUsers()
    } catch (e: any) { setMsg(e.response?.data?.detail || '批量封禁失败') }
    setTimeout(() => setMsg(''), 3000)
  }
  const handleBatchActivate = async () => {
    const ids = Array.from(selectedIds)
    if (!confirm(`确认批量启用 ${ids.length} 个用户？`)) return
    try {
      const { data } = await adminApi.put('/users/batch/activate', { user_ids: ids })
      setMsg(`已启用 ${data.affected} 个用户`); fetchUsers()
    } catch (e: any) { setMsg(e.response?.data?.detail || '批量启用失败') }
    setTimeout(() => setMsg(''), 3000)
  }
  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds)
    if (!confirm(`确认批量删除 ${ids.length} 个用户？此操作不可恢复`)) return
    try {
      const { data } = await adminApi.delete('/users/batch/delete', { data: { user_ids: ids } })
      setMsg(`已删除 ${data.affected} 个用户`); fetchUsers()
    } catch (e: any) { setMsg(e.response?.data?.detail || '批量删除失败') }
    setTimeout(() => setMsg(''), 3000)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>用户管理</h2>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
        }}><Plus size={14} /> 添加用户</button>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius-sm)', background: msg.includes('成功') ? '#10b98120' : '#ef444420', color: msg.includes('成功') ? '#10b981' : '#ef4444', fontSize: 13 }}>{msg}</div>
      )}

      {/* 添加用户表单 */}
      {showAdd && (
        <div style={{ padding: 16, marginBottom: 16, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>新建用户</span>
            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>用户名 *</label>
              <input value={addForm.username} onChange={e => setAddForm({ ...addForm, username: e.target.value })} style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>密码 *</label>
              <input type="password" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>昵称</label>
              <input value={addForm.nickname} onChange={e => setAddForm({ ...addForm, nickname: e.target.value })} style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
              <select value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })} style={{ padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 13 }}>
                <option value="user">用户</option><option value="admin">管理员</option>
              </select>
              <button onClick={handleAdd} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 搜索 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="搜索用户名或昵称..."
            style={{ width: '100%', padding: '10px 12px 10px 36px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '10px 16px', background: '#3b82f610', borderRadius: 'var(--radius-sm)', border: '1px solid #3b82f630' }}>
          <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>已选择 {selectedIds.size} 个用户</span>
          <button onClick={handleBatchBan} style={{ padding: '6px 14px', background: '#f59e0b', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Ban size={12} /> 批量封禁</button>
          <button onClick={handleBatchActivate} style={{ padding: '6px 14px', background: '#10b981', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> 批量启用</button>
          <button onClick={handleBatchDelete} style={{ padding: '6px 14px', background: '#ef4444', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Trash2 size={12} /> 批量删除</button>
          <button onClick={() => setSelectedIds(new Set())} style={{ padding: '6px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>取消选择</button>
        </div>
      )}

      {/* 表格 */}
      <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--bg-secondary)' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, width: 36 }}>
              <input type="checkbox" checked={users.length > 0 && selectedIds.size === users.length} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
            </th>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>ID</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>用户名</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>昵称</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>角色</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>状态</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>最近登录</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>注册时间</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>操作</th>
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', background: selectedIds.has(u.id) ? '#3b82f608' : undefined }}>
                <td style={{ padding: '10px 14px' }}>
                  <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} style={{ cursor: 'pointer' }} />
                </td>
                <td style={{ padding: '10px 14px' }}>{u.id}</td>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>{u.username}</td>
                <td style={{ padding: '10px 14px' }}>{u.nickname || '-'}</td>
                <td style={{ padding: '10px 14px' }}>
                  {u.id === 1 ? (
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#f59e0b20', color: '#f59e0b' }}>superadmin</span>
                  ) : (
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)} style={{ padding: '2px 6px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}>
                      <option value="user">用户</option><option value="admin">管理员</option>
                    </select>
                  )}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ color: u.is_active ? '#10b981' : '#ef4444', fontSize: 12 }}>{u.is_active ? '正常' : '封禁'}</span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {u.last_login_at ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} style={{ color: 'var(--text-tertiary)' }} />
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{new Date(u.last_login_at).toLocaleDateString()}</span>
                      {(() => {
                        const daysSince = Math.floor((Date.now() - new Date(u.last_login_at).getTime()) / 86400000)
                        if (daysSince > 30) return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 5px', borderRadius: 8, fontSize: 10, background: '#f59e0b20', color: '#f59e0b', fontWeight: 600 }}>
                            <AlertTriangle size={9} /> 僵尸
                          </span>
                        )
                        return null
                      })()}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>从未登录</span>
                  )}
                </td>
                <td style={{ padding: '10px 14px', color: 'var(--text-tertiary)', fontSize: 12 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setShowReset(u.id)} title="重置密码" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}><KeyRound size={14} /></button>
                    <button onClick={() => handleBan(u.id, u.is_active)} title={u.is_active ? '封禁' : '激活'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: u.is_active ? '#ef4444' : '#10b981', padding: 4 }}>
                      {u.is_active ? <Ban size={14} /> : <CheckCircle size={14} />}
                    </button>
                    <button onClick={() => handleDelete(u.id)} title="删除" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 重置密码弹窗 */}
      {showReset !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ padding: 24, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', width: 360 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>重置密码</h3>
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="输入新密码 (至少6位)" style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowReset(null); setNewPwd('') }} style={{ padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>取消</button>
              <button onClick={() => handleResetPwd(showReset)} disabled={newPwd.length < 6} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, opacity: newPwd.length < 6 ? 0.5 : 1 }}>确认重置</button>
            </div>
          </div>
        </div>
      )}

      {/* 分页 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>共 {total} 条 · 第 {page}/{totalPages || 1} 页</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '6px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: page <= 1 ? 'not-allowed' : 'pointer', color: 'var(--text-primary)', opacity: page <= 1 ? 0.5 : 1 }}><ChevronLeft size={14} /></button>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: '6px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: 'var(--text-primary)', opacity: page >= totalPages ? 0.5 : 1 }}><ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  )
}
