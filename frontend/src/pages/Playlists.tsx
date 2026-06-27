import { useState, useEffect, useRef } from 'react'
import { useIsMobile } from '../hooks/useBreakpoint'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import { useDownloadStore } from '../stores/downloadStore'
import type { Playlist, Song } from '../types'
import {
  Plus, Heart, ListMusic, Trash2, Share2,
  Play, Music2, X, ChevronRight, Edit3, Check, Download,
} from 'lucide-react'

export default function Playlists() {
  const isMobile = useIsMobile()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareCode, setShareCode] = useState('')
  const [importCode, setImportCode] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showImportText, setShowImportText] = useState(false)
  const [importText, setImportText] = useState({ name: '', source: 'netease', content: '' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const { play } = usePlayerStore()
  const addDownloadTask = useDownloadStore(s => s.addTask)

  // 批量下载歌单全部歌曲
  const handleDownloadAll = (pl: Playlist) => {
    pl.songs.forEach((s) => {
      addDownloadTask({
        song_name: s.song_name, singers: s.singers, album: s.album,
        ext: s.ext, file_size: '', duration: '', duration_s: s.duration,
        source: s.source, song_identifier: s.song_identifier,
        download_url: '', cover_url: s.cover_url, lyric: '',
        with_valid_download_url: false,
      } as Song)
    })
  }

  const fetchPlaylists = async () => {
    const { data } = await api.get('/playlists')
    setPlaylists(data)
  }

  useEffect(() => { fetchPlaylists() }, [])

  const createPlaylist = async () => {
    if (!newName.trim()) return
    await api.post('/playlists', { name: newName.trim() })
    setNewName('')
    setShowCreate(false)
    fetchPlaylists()
  }

  const deletePlaylist = async (id: number) => {
    await api.delete(`/playlists/${id}`)
    if (activeId === id) setActiveId(null)
    fetchPlaylists()
  }

  const sharePlaylist = async (id: number) => {
    const { data } = await api.post('/share', { playlist_id: id })
    setShareCode(data.share_code)
    setShowShareModal(true)
  }

  const importPlaylist = async () => {
    if (!importCode.trim()) return
    await api.post(`/share/${importCode.trim()}/import`)
    setImportCode('')
    setShowImport(false)
    fetchPlaylists()
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 导出歌单为 JSON 文件(本地下载,可跨账号/跨端迁移)
  const handleExportJson = async (id: number, name: string) => {
    try {
      const { data } = await api.get(`/playlists/${id}/export`)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name.replace(/[\\/:*?"<>|]/g, '_')}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('导出失败,请重试')
    }
  }

  // 从本地 JSON 文件导入歌单
  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const payload = JSON.parse(await file.text())
      await api.post('/playlists/import', {
        name: payload.name, description: payload.description || '',
        songs: Array.isArray(payload.songs) ? payload.songs : [],
      })
      fetchPlaylists()
    } catch {
      alert('导入失败:文件格式不正确')
    }
    e.target.value = ''
  }

  // 从网易云等平台导出的歌单文本导入
  const handleImportText = async () => {
    if (!importText.content.trim() || !importText.name.trim()) {
      alert('请填写歌单名称和歌曲文本')
      return
    }
    try {
      await api.post('/playlists/import-text', {
        name: importText.name.trim(),
        text: importText.content,
        source: importText.source,
      })
      setShowImportText(false)
      setImportText({ name: '', source: 'netease', content: '' })
      fetchPlaylists()
    } catch {
      alert('导入失败,请重试')
    }
  }

  const startEdit = (pl: Playlist) => {
    setEditingId(pl.id)
    setEditName(pl.name)
    setEditDesc(pl.description || '')
  }

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return
    await api.put(`/playlists/${editingId}`, { name: editName.trim(), description: editDesc.trim() })
    setEditingId(null)
    fetchPlaylists()
  }

  const removeSong = async (playlistId: number, songId: number) => {
    await api.delete(`/playlists/${playlistId}/songs/${songId}`)
    fetchPlaylists()
  }

  const playSong = (song: any, allSongs: any[]) => {
    const songList: Song[] = allSongs.map((s) => ({
      song_name: s.song_name, singers: s.singers, album: s.album,
      ext: s.ext, file_size: '', duration: '', duration_s: s.duration,
      source: s.source, song_identifier: s.song_identifier,
      download_url: '', cover_url: s.cover_url, lyric: '',
      with_valid_download_url: false,
    }))
    const current: Song = {
      song_name: song.song_name, singers: song.singers, album: song.album,
      ext: song.ext, file_size: '', duration: '', duration_s: song.duration,
      source: song.source, song_identifier: song.song_identifier,
      download_url: '', cover_url: song.cover_url, lyric: '',
      with_valid_download_url: false,
    }
    play(current, songList)
  }

  const playAll = (songs: any[]) => {
    const songList: Song[] = songs.map((s) => ({
      song_name: s.song_name, singers: s.singers, album: s.album,
      ext: s.ext, file_size: '', duration: '', duration_s: s.duration,
      source: s.source, song_identifier: s.song_identifier,
      download_url: '', cover_url: s.cover_url, lyric: '',
      with_valid_download_url: false,
    }))
    if (songList.length > 0) play(songList[0], songList)
  }

  const activePlaylist = playlists.find((p) => p.id === activeId)

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700 }}>我的歌单</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowImport(true)} style={{
            padding: isMobile ? '6px 12px' : '8px 16px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
          }}>
            导入
          </button>
          <button onClick={() => fileInputRef.current?.click()} title="从 JSON 文件导入歌单" style={{
            padding: isMobile ? '6px 12px' : '8px 16px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
          }}>
            导入文件
          </button>
          <button onClick={() => setShowImportText(true)} title="从网易云/QQ等平台导出的歌单文本导入" style={{
            padding: isMobile ? '6px 12px' : '8px 16px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
          }}>
            导入歌单文本
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportJsonFile} style={{ display: 'none' }} />
          <button onClick={() => setShowCreate(true)} style={{
            padding: isMobile ? '6px 12px' : '8px 16px', background: 'var(--accent)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Plus size={14} /> 新建
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: isMobile ? 16 : 24 }}>
        {/* Sidebar list */}
        <div>
          {playlists.map((pl) => (
            <div key={pl.id} onClick={() => setActiveId(pl.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: activeId === pl.id ? 'var(--accent-light)' : 'transparent', marginBottom: 2,
            }}>
              {pl.is_favorite ? (
                <Heart size={16} style={{ color: 'var(--accent)' }} />
              ) : (
                <ListMusic size={16} style={{ color: 'var(--text-tertiary)' }} />
              )}
              <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pl.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{pl.song_count}</span>
              {isMobile && <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />}
            </div>
          ))}
        </div>

        {/* Song list */}
        <div>
          {activePlaylist ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  {editingId === activePlaylist.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        style={{ padding: '4px 8px', fontSize: 18, fontWeight: 600, border: '1px solid var(--accent)',
                          borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
                      <button onClick={saveEdit} style={{
                        background: 'var(--accent)', border: 'none', borderRadius: 4, cursor: 'pointer',
                        color: '#fff', padding: '4px 8px', fontSize: 13,
                      }}><Check size={14} /></button>
                      <button onClick={() => setEditingId(null)} style={{
                        background: 'var(--bg-secondary)', border: 'none', borderRadius: 4, cursor: 'pointer',
                        color: 'var(--text-secondary)', padding: '4px 8px', fontSize: 13,
                      }}><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2 }}>{activePlaylist.name}</h3>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                          {activePlaylist.song_count} 首歌曲
                        </span>
                        {activePlaylist.description && (
                          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                            · {activePlaylist.description}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {activePlaylist.songs.length > 0 && (
                    <button onClick={() => playAll(activePlaylist.songs)} style={{
                      padding: '8px 16px', background: 'var(--accent)', border: 'none',
                      borderRadius: 'var(--radius-sm)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Play size={13} /> 播放全部
                    </button>
                  )}
                  {activePlaylist.songs.length > 0 && (
                    <button onClick={() => handleDownloadAll(activePlaylist)} title="下载全部" style={{
                      padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Download size={13} /> 下载全部
                    </button>
                  )}
                  <button onClick={() => startEdit(activePlaylist)} title="编辑歌单" style={{
                    padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)',
                  }}>
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => sharePlaylist(activePlaylist.id)} title="分享" style={{
                    padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)',
                  }}>
                    <Share2 size={14} />
                  </button>
                  <button onClick={() => handleExportJson(activePlaylist.id, activePlaylist.name)} title="导出为 JSON" style={{
                    padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)',
                  }}>
                    <Download size={14} />
                  </button>
                  {!activePlaylist.is_favorite && (
                    <button onClick={() => deletePlaylist(activePlaylist.id)} title="删除歌单" style={{
                      padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-tertiary)',
                    }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Edit description */}
              {editingId === activePlaylist.id && (
                <div style={{ marginBottom: 16 }}>
                  <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                    placeholder="歌单描述（可选）" onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
                </div>
              )}

              {activePlaylist.songs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
                  <Music2 size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                  <p>歌单还是空的，去搜索添加歌曲吧</p>
                </div>
              ) : (
                activePlaylist.songs.map((song, idx) => (
                  <div key={song.id} style={{
                    display: isMobile ? 'flex' : 'grid',
                    gridTemplateColumns: isMobile ? undefined : '32px 1fr 120px 60px 40px',
                    alignItems: 'center', gap: isMobile ? 8 : 0,
                    padding: isMobile ? '10px 0' : '8px 12px',
                    borderBottom: '1px solid var(--border)',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-tertiary)', width: isMobile ? 20 : 32, flexShrink: 0, textAlign: 'center' }}>
                      {idx + 1}
                    </span>
                    <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {song.song_name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {song.singers}{song.album ? ` · ${song.album}` : ''}
                      </div>
                    </div>
                    {!isMobile && (
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{song.source}</span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : '-'}
                    </span>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button onClick={() => playSong(song, activePlaylist.songs)} title="播放"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}>
                        <Play size={13} />
                      </button>
                      <button onClick={() => removeSong(activePlaylist.id, song.id)} title="移除"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
              <ListMusic size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
              <p>选择一个歌单查看</p>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ width: isMobile ? '90%' : 360, padding: 24, background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginBottom: 16, fontWeight: 600 }}>新建歌单</h3>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="歌单名称"
              onKeyDown={(e) => e.key === 'Enter' && createPlaylist()} autoFocus
              style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setNewName('') }} style={{
                padding: '8px 16px', background: 'var(--bg-secondary)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)',
              }}>取消</button>
              <button onClick={createPlaylist} style={{
                padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#fff', fontWeight: 600,
              }}>创建</button>
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {showShareModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ width: isMobile ? '90%' : 360, padding: 24, background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                <X size={18} />
              </button>
            </div>
            <Share2 size={32} style={{ color: 'var(--accent)', marginBottom: 12 }} />
            <h3 style={{ marginBottom: 8, fontWeight: 600 }}>分享歌单</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>将以下分享码发送给好友</p>
            <div style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
              fontFamily: 'monospace', fontSize: 28, fontWeight: 700, letterSpacing: 8, color: 'var(--accent)' }}>
              {shareCode}
            </div>
            <button onClick={() => navigator.clipboard.writeText(shareCode)} style={{
              marginTop: 16, padding: '8px 20px', background: 'var(--accent)', border: 'none',
              borderRadius: 'var(--radius-sm)', color: '#fff', cursor: 'pointer', fontWeight: 600,
            }}>复制分享码</button>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ width: isMobile ? '90%' : 360, padding: 24, background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginBottom: 16, fontWeight: 600 }}>导入歌单</h3>
            <input value={importCode} onChange={(e) => setImportCode(e.target.value.toUpperCase())}
              placeholder="输入6位分享码" maxLength={6}
              style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 18, letterSpacing: 4, outline: 'none', marginBottom: 16,
                textAlign: 'center', fontFamily: 'monospace' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowImport(false); setImportCode('') }} style={{
                padding: '8px 16px', background: 'var(--bg-secondary)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)',
              }}>取消</button>
              <button onClick={importPlaylist} style={{
                padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#fff', fontWeight: 600,
              }}>导入</button>
            </div>
          </div>
        </div>
      )}

      {/* 导入歌单文本(网易云等平台导出) */}
      {showImportText && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', padding: 24, background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>导入歌单文本</h3>
              <button onClick={() => setShowImportText(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16, lineHeight: 1.5 }}>
              粘贴从网易云音乐等平台导出的歌单(每行一首,格式「歌曲名 - 歌手」)。播放时自动按歌名匹配音源取流。
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={importText.name} onChange={(e) => setImportText({ ...importText, name: e.target.value })} placeholder="歌单名称" style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
              <select value={importText.source} onChange={(e) => setImportText({ ...importText, source: e.target.value })} style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}>
                <option value="netease">网易云</option>
                <option value="qqmusic">QQ音乐</option>
                <option value="kugou">酷狗</option>
                <option value="kuwo">酷我</option>
                <option value="migu">咪咕</option>
              </select>
            </div>
            <textarea value={importText.content} onChange={(e) => setImportText({ ...importText, content: e.target.value })} placeholder={'每行一首,例如:\n晴天 - 周杰伦\n稻香 - 周杰伦\n起风了 - 买辣椒也用券'} rows={10} style={{ flex: 1, minHeight: 200, padding: '12px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.6 }} />
            <button onClick={handleImportText} style={{ marginTop: 16, padding: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              导入歌单
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
