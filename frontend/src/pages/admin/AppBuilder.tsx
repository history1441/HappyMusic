import { useState, useEffect, useRef } from 'react'
import api from '../../services/api'
import { Smartphone, Monitor, Apple, Download, Upload, Trash2, CheckCircle, Globe, Eye, EyeOff, X, RefreshCw, History, Package } from 'lucide-react'

interface Release {
  id: number
  build_type: string
  version: string
  platform: string
  changelog: string
  is_published: boolean
  status: string
  message: string
  filename: string
  file_size: number
  downloads: number
  started_at: string | null
  completed_at: string | null
}

const PLATFORMS = [
  { value: 'android', icon: Smartphone, label: 'Android', color: '#3ddc84', ext: '.apk' },
  { value: 'windows', icon: Monitor, label: 'Windows', color: '#0078d4', ext: '.exe' },
  { value: 'ios', icon: Apple, label: 'iOS', color: '#007aff', ext: '.ipa' },
  { value: 'web', icon: Globe, label: 'Web', color: '#6366f1', ext: '.zip' },
]

export default function AppBuilder() {
  const [releases, setReleases] = useState<Release[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [version, setVersion] = useState('')
  const [platform, setPlatform] = useState('android')
  const [changelog, setChangelog] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<Release[]>([])
  const [tab, setTab] = useState<'published' | 'drafts'>('published')
  const token = localStorage.getItem('admin_token')
  const h = { headers: { Authorization: `Bearer ${token}` } }
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchReleases() }, [])

  const fetchReleases = async () => {
    try {
      const { data } = await api.get('/admin/builds/releases', h)
      setReleases(data.records || [])
    } catch {}
  }

  const fetchHistory = async () => {
    try {
      const { data } = await api.get('/admin/builds/history', h)
      setHistory(data.records || [])
    } catch {}
  }

  const handleUpload = async () => {
    const f = fileRef.current?.files?.[0]
    if (!f) return alert('请选择文件')
    if (!version.trim()) return alert('请输入版本号')
    setUploading(true)
    setUploadProgress(0)
    try {
      const form = new FormData()
      form.append('file', f)
      form.append('version', version.trim())
      form.append('platform', platform)
      if (changelog.trim()) form.append('changelog', changelog.trim())
      await api.post('/admin/builds/upload', form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        timeout: 600000,
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      setVersion(''); setChangelog(''); setPlatform('android')
      if (fileRef.current) fileRef.current.value = ''
      fetchReleases()
    } catch (e: any) {
      alert(e.response?.data?.detail || '上传失败，请重试')
    } finally {
      setUploading(false); setUploadProgress(0)
    }
  }

  const togglePublish = async (id: number, published: boolean) => {
    try {
      await api.put(`/admin/builds/releases/${id}/publish`, { published }, h)
      fetchReleases()
    } catch {}
  }

  const deleteRelease = async (id: number) => {
    if (!confirm('确定删除此版本？关联的文件也会被删除，此操作不可恢复。')) return
    try {
      await api.delete(`/admin/builds/releases/${id}`, h)
      fetchReleases()
    } catch {}
  }

  const downloadFile = async (name: string) => {
    try {
      const resp = await api.get(`/admin/builds/download/${name}`, {
        headers: { Authorization: `Bearer ${token}` }, responseType: 'blob',
        timeout: 300000,
      })
      const url = window.URL.createObjectURL(new Blob([resp.data]))
      const link = document.createElement('a')
      link.href = url; link.download = name; link.click()
      window.URL.revokeObjectURL(url)
    } catch { alert('下载失败') }
  }

  const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`
  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString('zh-CN') : '-'
  const getPlatform = (p: string) => PLATFORMS.find(pl => pl.value === p) || PLATFORMS[3]

  const publishedReleases = releases.filter(r => r.is_published)
  const draftReleases = releases.filter(r => !r.is_published)
  const activeList = tab === 'published' ? publishedReleases : draftReleases

  const grouped = PLATFORMS.map(p => ({
    ...p,
    items: activeList.filter(r => r.platform === p.value),
  }))

  const selectedPlat = PLATFORMS.find(p => p.value === platform)!
  const SelectedIcon = selectedPlat.icon

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={22} style={{ color: 'var(--accent)' }} /> 应用发布管理
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory() }} style={{
            padding: '6px 14px', background: showHistory ? 'var(--accent)' : 'var(--bg-secondary)',
            color: showHistory ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <History size={14} /> {showHistory ? '返回版本列表' : '发布历史'}
          </button>
          <button onClick={fetchReleases} style={{
            padding: '6px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <RefreshCw size={14} /> 刷新
          </button>
        </div>
      </div>

      {showHistory ? (
        /* ===== 发布历史 ===== */
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={16} style={{ color: 'var(--accent)' }} /> 全部发布历史
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>{history.length} 条记录</span>
          </div>
          {history.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>暂无发布历史</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['版本', '平台', '状态', '发布', '文件大小', '下载次数', '时间', '操作'].map(t => (
                      <th key={t} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap' }}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(r => {
                    const pi = getPlatform(r.platform)
                    const PI = pi.icon
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>v{r.version}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: pi.color }}>
                            <PI size={14} /> {pi.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: r.status === 'success' ? '#10b98120' : '#ef444420', color: r.status === 'success' ? '#10b981' : '#ef4444' }}>
                            {r.status === 'success' ? '成功' : r.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {r.is_published ? (
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#10b98120', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 3 }}><CheckCircle size={10} /> 已发布</span>
                          ) : (
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f59e0b20', color: '#f59e0b' }}>未发布</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)' }}>{fmtSize(r.file_size)}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)' }}>{r.downloads}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{fmtDate(r.completed_at)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {r.filename && (
                              <button onClick={() => downloadFile(r.filename)} style={{ padding: '3px 8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Download size={10} />
                              </button>
                            )}
                            <button onClick={() => deleteRelease(r.id)} style={{ padding: '3px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ===== 上传区域 ===== */}
          <div style={{ padding: 24, marginBottom: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Upload size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>发布新版本</span>
            </div>

            {/* 平台选择 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>选择平台</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {PLATFORMS.map(p => {
                  const PI = p.icon
                  const active = platform === p.value
                  return (
                    <button key={p.value} onClick={() => setPlatform(p.value)} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '10px 16px', borderRadius: 'var(--radius-sm)',
                      background: active ? `${p.color}15` : 'var(--bg-secondary)',
                      border: active ? `2px solid ${p.color}` : '1px solid var(--border)',
                      cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
                      color: active ? p.color : 'var(--text-secondary)',
                      transition: 'all 0.15s',
                    }}>
                      <PI size={16} />
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 文件选择 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>安装包文件</div>
              <input ref={fileRef} type="file" accept={selectedPlat.ext + ',.zip,.dmg,.appimage'} style={{ display: 'none' }} onChange={e => {
                const f = e.target.files?.[0]
                if (f) {
                  const nameEl = document.getElementById('selected-file-name')
                  if (nameEl) nameEl.textContent = f.name
                }
              }} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={() => fileRef.current?.click()} style={{
                  padding: '8px 18px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                }}>
                  <Upload size={14} /> 选择文件
                </button>
                <span id="selected-file-name" style={{ fontSize: 13, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  未选择文件
                </span>
              </div>
            </div>

            {/* 版本号 + 发布按钮 */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>版本号 *</div>
                <input value={version} onChange={e => setVersion(e.target.value)} placeholder="如 1.1.0" style={{
                  width: '100%', padding: '9px 12px', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                  boxSizing: 'border-box',
                }} />
              </div>
              <button onClick={handleUpload} disabled={uploading} style={{
                padding: '9px 28px', background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 'var(--radius-sm)', cursor: uploading ? 'wait' : 'pointer', fontWeight: 600, fontSize: 14,
                opacity: uploading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                marginTop: 20,
              }}>
                <SelectedIcon size={15} />
                {uploading ? `${uploadProgress}%` : '发布'}
              </button>
            </div>

            {/* 上传进度条 */}
            {uploading && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>正在上传... {uploadProgress}%</div>
              </div>
            )}

            {/* 更新说明 */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>更新说明（可选）</div>
              <textarea value={changelog} onChange={e => setChangelog(e.target.value)} placeholder="请描述此版本的更新内容，支持多行..."
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 72, boxSizing: 'border-box', lineHeight: 1.6,
                }} />
            </div>
          </div>

          {/* ===== Tab 切换：已发布 / 草稿 ===== */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
            <button onClick={() => setTab('published')} style={{
              padding: '10px 20px', background: tab === 'published' ? 'var(--card)' : 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderBottom: tab === 'published' ? '1px solid var(--card)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', cursor: 'pointer', fontSize: 13, fontWeight: tab === 'published' ? 600 : 400,
              color: tab === 'published' ? 'var(--accent)' : 'var(--text-secondary)',
              position: 'relative', zIndex: 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <CheckCircle size={14} /> 已发布
              <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>{publishedReleases.length}</span>
            </button>
            <button onClick={() => setTab('drafts')} style={{
              padding: '10px 20px', background: tab === 'drafts' ? 'var(--card)' : 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderBottom: tab === 'drafts' ? '1px solid var(--card)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', cursor: 'pointer', fontSize: 13, fontWeight: tab === 'drafts' ? 600 : 400,
              color: tab === 'drafts' ? '#f59e0b' : 'var(--text-secondary)',
              position: 'relative', zIndex: 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              草稿箱
              <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>{draftReleases.length}</span>
            </button>
          </div>

          {/* ===== 版本列表 ===== */}
          <div style={{ background: 'var(--card)', borderRadius: '0 0 var(--radius) var(--radius)', border: '1px solid var(--border)', borderTop: 'none' }}>
            {grouped.every(g => g.items.length === 0) ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                {tab === 'published' ? '暂无已发布版本' : '暂无草稿版本'}
              </div>
            ) : (
              grouped.filter(g => g.items.length > 0).map(g => {
                const PI = g.icon
                return (
                  <div key={g.value} style={{ borderBottom: '1px solid var(--border)' }}>
                    <div style={{ padding: '10px 16px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PI size={14} style={{ color: g.color }} />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{g.label}</span>
                      <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}>{g.items.length}</span>
                    </div>
                    {g.items.map(r => {
                      const expanded = expandedId === r.id
                      return (
                        <div key={r.id} style={{ borderBottom: '1px solid var(--border)', background: expanded ? 'var(--bg-secondary)' : 'transparent' }}>
                          <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <span style={{ fontWeight: 700, fontSize: 15 }}>v{r.version}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtSize(r.file_size)}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Download size={11} /> {r.downloads} 次下载
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{fmtDate(r.completed_at)}</span>
                              {r.changelog && (
                                <button onClick={() => setExpandedId(expanded ? null : r.id)} style={{
                                  padding: '4px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)',
                                }}>
                                  {expanded ? '收起' : '说明'}
                                </button>
                              )}
                              {r.is_published ? (
                                <button onClick={() => togglePublish(r.id, false)}
                                  style={{ padding: '4px 10px', background: '#f59e0b15', border: '1px solid #f59e0b40', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b', fontWeight: 500 }}>
                                  <EyeOff size={12} /> 撤销发布
                                </button>
                              ) : (
                                <button onClick={() => togglePublish(r.id, true)}
                                  style={{ padding: '4px 10px', background: '#10b98115', border: '1px solid #10b98140', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontWeight: 500 }}>
                                  <Eye size={12} /> 发布
                                </button>
                              )}
                              <button onClick={() => downloadFile(r.filename)}
                                style={{ padding: '4px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Download size={12} /> 下载
                              </button>
                              <button onClick={() => deleteRelease(r.id)}
                                style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          {expanded && r.changelog && (
                            <div style={{ padding: '0 16px 14px 16px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                              {r.changelog}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
