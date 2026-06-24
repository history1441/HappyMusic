import { useState, useRef, useCallback, useEffect } from 'react'
import { useIsMobile } from '../hooks/useBreakpoint'
import {
  saveLocalFile, getLocalSongs, deleteLocalSong, deleteLocalSongs, getLocalSongBlob,
  extractAudioMeta,
  createLocalPlaylist, getLocalPlaylists, deleteLocalPlaylist, updateLocalPlaylist,
  addSongToLocalPlaylist, removeSongFromLocalPlaylist, getLocalPlaylistWithSongs,
  type LocalSong, type LocalPlaylist,
} from '../hooks/useDB'
import { usePlayerStore } from '../stores/playerStore'
import type { Song } from '../types'
import {
  FolderOpen, Trash2, Play, Music2, Upload, HardDrive,
  Search, CheckSquare, Square, X, Plus,
  ListMusic, Edit3,
} from 'lucide-react'

const ACCEPT = '.mp3,.flac,.wav,.ogg,.aac,.m4a,.wma'

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

function formatDuration(s: number) {
  if (!s || isNaN(s)) return '--:--'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

type SortKey = 'name' | 'addedAt' | 'size' | 'type'
type Tab = 'songs' | 'playlists'

export default function LocalFiles() {
  const isMobile = useIsMobile()
  const [files, setFiles] = useState<LocalSong[]>([])
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('addedAt')
  const [sortDesc, setSortDesc] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [tab, setTab] = useState<Tab>('songs')
  const inputRef = useRef<HTMLInputElement>(null)
  const { play } = usePlayerStore()

  // Local playlists
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>([])
  const [activePlId, setActivePlId] = useState<string | null>(null)
  const [plSongs, setPlSongs] = useState<(LocalSong & { entryId: number })[]>([])
  const [showCreatePl, setShowCreatePl] = useState(false)
  const [newPlName, setNewPlName] = useState('')
  const [editingPl, setEditingPl] = useState<string | null>(null)
  const [editPlName, setEditPlName] = useState('')
  const [addToPlSongId, setAddToPlSongId] = useState<string | null>(null)

  const fetchFiles = async () => {
    const list = await getLocalSongs()
    setFiles(list)
  }

  const fetchPlaylists = async () => {
    setPlaylists(await getLocalPlaylists())
  }

  const fetchPlSongs = async (plId: string) => {
    const { songs } = await getLocalPlaylistWithSongs(plId)
    setPlSongs(songs.filter(s => s.meta).map(s => ({ ...s.meta!, entryId: s.id! })))
  }

  useEffect(() => { fetchFiles(); fetchPlaylists() }, [])

  const importFiles = async (fileList: FileList | File[]) => {
    setImporting(true)
    const arr = Array.from(fileList).filter((f) => /\.(mp3|flac|wav|ogg|aac|m4a|wma)$/i.test(f.name))
    for (const file of arr) {
      const name = file.name.replace(/\.[^.]+$/, '')
      const id = `local:${name}-${file.size}-${Date.now()}`
      const meta = await extractAudioMeta(file)
      await saveLocalFile(id, file, {
        name,
        artists: '本地音乐',
        album: '',
        duration: meta.duration,
        type: file.name.split('.').pop()?.toUpperCase() || 'MP3',
        size: file.size,
        coverUrl: meta.coverUrl,
      })
    }
    await fetchFiles()
    setImporting(false)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files)
  }, [])

  const playLocal = async (lf: LocalSong) => {
    const blob = await getLocalSongBlob(lf.id)
    if (!blob) return
    const song: Song = {
      song_name: lf.name, singers: lf.artists, album: lf.album,
      ext: lf.type.toLowerCase(), file_size: '', duration: '', duration_s: lf.duration,
      source: 'local', song_identifier: lf.id,
      download_url: URL.createObjectURL(blob), cover_url: lf.coverUrl || '',
      lyric: '', with_valid_download_url: true,
    }
    play(song)
  }

  const playAllLocal = async (songs: LocalSong[]) => {
    const playable = songs.filter(() => true)
    if (playable.length === 0) return
    const songList: Song[] = []
    for (const lf of playable) {
      const blob = await getLocalSongBlob(lf.id)
      if (!blob) continue
      songList.push({
        song_name: lf.name, singers: lf.artists, album: lf.album,
        ext: lf.type.toLowerCase(), file_size: '', duration: '', duration_s: lf.duration,
        source: 'local', song_identifier: lf.id,
        download_url: URL.createObjectURL(blob), cover_url: lf.coverUrl || '',
        lyric: '', with_valid_download_url: true,
      })
    }
    if (songList.length > 0) play(songList[0], songList)
  }

  const handleDelete = async (id: string) => {
    await deleteLocalSong(id)
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    fetchFiles()
  }

  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    await deleteLocalSongs(Array.from(selected))
    setSelected(new Set())
    setSelectMode(false)
    fetchFiles()
  }

  const toggleSelectAll = () => {
    if (selected.size === filteredFiles.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredFiles.map(f => f.id)))
    }
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc)
    else { setSortKey(key); setSortDesc(false) }
  }

  // Sort and filter
  const filteredFiles = files
    .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'addedAt') cmp = a.addedAt - b.addedAt
      else if (sortKey === 'size') cmp = a.size - b.size
      else if (sortKey === 'type') cmp = a.type.localeCompare(b.type)
      return sortDesc ? -cmp : cmp
    })

  const handleCreatePlaylist = async () => {
    if (!newPlName.trim()) return
    await createLocalPlaylist(newPlName.trim())
    setNewPlName('')
    setShowCreatePl(false)
    fetchPlaylists()
  }

  const handleAddToPlaylist = async (plId: string, songId: string) => {
    await addSongToLocalPlaylist(plId, songId)
    setAddToPlSongId(null)
    if (activePlId === plId) fetchPlSongs(plId)
  }

  const handleRemoveFromPlaylist = async (entryId: number) => {
    await removeSongFromLocalPlaylist(entryId)
    if (activePlId) fetchPlSongs(activePlId)
  }

  const handleEditPlaylist = async (plId: string) => {
    await updateLocalPlaylist(plId, { name: editPlName.trim() })
    setEditingPl(null)
    setEditPlName('')
    fetchPlaylists()
  }

  const sortLabels: { key: SortKey; label: string }[] = [
    { key: 'addedAt', label: '时间' },
    { key: 'name', label: '名称' },
    { key: 'size', label: '大小' },
    { key: 'type', label: '格式' },
  ]

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FolderOpen size={24} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700 }}>本地音乐</h2>
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden
          onChange={(e) => e.target.files && importFiles(e.target.files)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => inputRef.current?.click()} disabled={importing} style={{
            padding: isMobile ? '6px 12px' : '8px 16px', background: 'var(--accent)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Upload size={14} />
            {importing ? '导入中...' : '导入'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
        {[
          { key: 'songs' as Tab, label: `全部歌曲 (${files.length})`, icon: Music2 },
          { key: 'playlists' as Tab, label: `本地歌单 (${playlists.length})`, icon: ListMusic },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setActivePlId(null) }} style={{
            padding: isMobile ? '8px 14px' : '10px 20px', border: 'none', cursor: 'pointer',
            background: 'transparent', fontSize: 14, fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <t.icon size={15} />
            {isMobile ? (t.key === 'songs' ? `歌曲(${files.length})` : `歌单(${playlists.length})`) : t.label}
          </button>
        ))}
      </div>

      {/* ===== Songs Tab ===== */}
      {tab === 'songs' && (
        <>
          {/* Search + Sort + Batch controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, position: 'relative', minWidth: 160 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索本地音乐..."
                style={{
                  width: '100%', padding: '8px 12px 8px 32px', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                }} />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {sortLabels.map(s => (
                <button key={s.key} onClick={() => toggleSort(s.key)} style={{
                  padding: '6px 10px', background: sortKey === s.key ? 'var(--accent-light)' : 'var(--bg-secondary)',
                  border: '1px solid', borderColor: sortKey === s.key ? 'var(--accent)' : 'var(--border)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12,
                  color: sortKey === s.key ? 'var(--accent)' : 'var(--text-secondary)',
                }}>
                  {s.label} {sortKey === s.key ? (sortDesc ? '↓' : '↑') : ''}
                </button>
              ))}
            </div>
            <button onClick={() => { setSelectMode(!selectMode); setSelected(new Set()) }} style={{
              padding: '6px 10px', background: selectMode ? 'var(--accent-light)' : 'var(--bg-secondary)',
              border: '1px solid', borderColor: selectMode ? 'var(--accent)' : 'var(--border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12,
              color: selectMode ? 'var(--accent)' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {selectMode ? <CheckSquare size={13} /> : <Square size={13} />}
              {selectMode ? '取消' : '多选'}
            </button>
          </div>

          {/* Batch action bar */}
          {selectMode && selected.size > 0 && (
            <div style={{
              display: 'flex', gap: 8, marginBottom: 12, padding: '8px 12px',
              background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                已选 {selected.size} 首
              </span>
              <button onClick={toggleSelectAll} style={{
                padding: '4px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12,
              }}>
                {selected.size === filteredFiles.length ? '取消全选' : '全选'}
              </button>
              <button onClick={handleBatchDelete} style={{
                padding: '4px 10px', background: '#ef4444', border: 'none',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12,
                color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Trash2 size={12} /> 删除
              </button>
            </div>
          )}

          {/* Drop zone */}
          {filteredFiles.length === 0 && !search && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', padding: 40,
                textAlign: 'center', marginBottom: 24,
                background: dragging ? 'var(--accent-light)' : 'var(--bg-secondary)',
                transition: 'all 0.2s', cursor: 'pointer',
              }}
              onClick={() => inputRef.current?.click()}
            >
              <HardDrive size={36} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                拖拽音乐文件到这里，或点击选择
              </p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 4 }}>
                支持 MP3, FLAC, WAV, OGG, AAC, M4A
              </p>
            </div>
          )}

          {/* Song list */}
          {filteredFiles.length > 0 && (
            <div>
              {!selectMode && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button onClick={() => playAllLocal(filteredFiles)} style={{
                    padding: '6px 14px', background: 'var(--accent)', border: 'none',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#fff',
                    fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Play size={12} /> 播放全部
                  </button>
                </div>
              )}
              {filteredFiles.map((lf) => {
                const isSelected = selected.has(lf.id)
                return (
                  <div key={lf.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12,
                      padding: isMobile ? '8px 4px' : '8px 12px',
                      borderBottom: '1px solid var(--border)',
                      background: isSelected ? 'var(--accent-light)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    {selectMode && (
                      <button onClick={() => setSelected(prev => {
                        const n = new Set(prev)
                        if (n.has(lf.id)) n.delete(lf.id); else n.add(lf.id)
                        return n
                      })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--accent)' }}>
                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    )}
                    <div onClick={() => !selectMode && playLocal(lf)} style={{
                      width: isMobile ? 42 : 44, height: isMobile ? 42 : 44, borderRadius: 6,
                      background: 'var(--bg-tertiary)', flexShrink: 0, overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: selectMode ? 'default' : 'pointer',
                    }}>
                      {lf.coverUrl ? (
                        <img src={lf.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Music2 size={18} style={{ color: 'var(--text-tertiary)' }} />
                      )}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }} onClick={() => !selectMode && playLocal(lf)}>
                      <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lf.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ padding: '0 4px', background: 'var(--accent-light)', borderRadius: 2, color: 'var(--accent)', fontSize: 10 }}>
                          {lf.type}
                        </span>
                        <span>{formatSize(lf.size)}</span>
                        {lf.duration > 0 && <span>{formatDuration(lf.duration)}</span>}
                      </div>
                    </div>
                    {!isMobile && (
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 80, textAlign: 'center' }}>
                        {new Date(lf.addedAt).toLocaleDateString()}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {!selectMode && (
                        <>
                          <button onClick={() => playLocal(lf)} style={{
                            width: isMobile ? 32 : 28, height: isMobile ? 32 : 28, borderRadius: '50%',
                            background: isMobile ? 'var(--accent)' : 'transparent', border: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: isMobile ? '#fff' : 'var(--accent)', padding: 0,
                          }}>
                            <Play size={isMobile ? 14 : 14} fill={isMobile ? 'currentColor' : 'none'} />
                          </button>
                          <button onClick={() => setAddToPlSongId(addToPlSongId === lf.id ? null : lf.id)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4,
                          }}>
                            <Plus size={14} />
                          </button>
                          <button onClick={() => handleDelete(lf.id)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4,
                          }}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                    {/* Add to playlist popup */}
                    {addToPlSongId === lf.id && (
                      <div style={{
                        position: 'absolute', right: isMobile ? 16 : 32,
                        background: 'var(--card)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)',
                        zIndex: 100, minWidth: 180, padding: 4,
                      }}>
                        <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                          添加到本地歌单
                        </div>
                        {playlists.length === 0 && (
                          <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--text-tertiary)' }}>暂无歌单</div>
                        )}
                        {playlists.map(pl => (
                          <button key={pl.id} onClick={() => handleAddToPlaylist(pl.id, lf.id)} style={{
                            display: 'block', width: '100%', padding: '8px 10px', background: 'none',
                            border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                            borderRadius: 4,
                          }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                             onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <ListMusic size={12} style={{ marginRight: 6, verticalAlign: -1 }} />
                            {pl.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {search && filteredFiles.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>
              未找到匹配「{search}」的本地音乐
            </div>
          )}
        </>
      )}

      {/* ===== Playlists Tab ===== */}
      {tab === 'playlists' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: isMobile ? 16 : 24 }}>
          {/* Playlist list */}
          <div>
            <button onClick={() => setShowCreatePl(true)} style={{
              width: '100%', padding: '10px 14px', background: 'var(--bg-secondary)',
              border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)',
              cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
            }}>
              <Plus size={14} /> 新建本地歌单
            </button>
            {playlists.map(pl => (
              <div key={pl.id} onClick={() => { setActivePlId(pl.id); fetchPlSongs(pl.id) }} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: activePlId === pl.id ? 'var(--accent-light)' : 'transparent',
                marginBottom: 2,
              }}>
                <ListMusic size={16} style={{ color: activePlId === pl.id ? 'var(--accent)' : 'var(--text-tertiary)' }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {editingPl === pl.id ? (
                    <input value={editPlName} onChange={e => setEditPlName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEditPlaylist(pl.id)}
                      onBlur={() => handleEditPlaylist(pl.id)}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                      style={{ width: '100%', padding: '2px 6px', fontSize: 13, border: '1px solid var(--accent)',
                        borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
                  ) : (
                    <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pl.name}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setEditingPl(pl.id); setEditPlName(pl.name) }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2,
                  }}>
                    <Edit3 size={12} />
                  </button>
                  <button onClick={() => deleteLocalPlaylist(pl.id).then(() => { fetchPlaylists(); if (activePlId === pl.id) setActivePlId(null) })} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2,
                  }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {playlists.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>
                还没有本地歌单
              </div>
            )}
          </div>

          {/* Playlist detail */}
          <div>
            {activePlId ? (
              <>
                {(() => {
                  const pl = playlists.find(p => p.id === activePlId)
                  return pl ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <h3 style={{ fontSize: 20, fontWeight: 600 }}>{pl.name}</h3>
                        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{plSongs.length} 首歌曲</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {plSongs.length > 0 && (
                          <button onClick={() => playAllLocal(plSongs)} style={{
                            padding: '8px 16px', background: 'var(--accent)', border: 'none',
                            borderRadius: 'var(--radius-sm)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <Play size={13} /> 播放全部
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null
                })()}

                {plSongs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
                    <Music2 size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                    <p>歌单还是空的</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>在「全部歌曲」中点击 + 添加歌曲</p>
                  </div>
                ) : (
                  plSongs.map((lf, idx) => (
                    <div key={lf.entryId} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 0', borderBottom: '1px solid var(--border)',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 24, textAlign: 'center' }}>{idx + 1}</span>
                      <div onClick={() => playLocal(lf)} style={{
                        width: 40, height: 40, borderRadius: 6, background: 'var(--bg-tertiary)',
                        flexShrink: 0, overflow: 'hidden', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {lf.coverUrl ? (
                          <img src={lf.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : <Music2 size={16} style={{ color: 'var(--text-tertiary)' }} />}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden', cursor: 'pointer' }} onClick={() => playLocal(lf)}>
                        <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {lf.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {lf.type} · {formatSize(lf.size)} {lf.duration > 0 && `· ${formatDuration(lf.duration)}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => playLocal(lf)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4,
                        }}>
                          <Play size={14} />
                        </button>
                        <button onClick={() => handleRemoveFromPlaylist(lf.entryId)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4,
                        }}>
                          <X size={14} />
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
      )}

      {/* Create playlist modal */}
      {showCreatePl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ width: isMobile ? '90%' : 360, padding: 24, background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginBottom: 16, fontWeight: 600 }}>新建本地歌单</h3>
            <input value={newPlName} onChange={e => setNewPlName(e.target.value)}
              placeholder="歌单名称" onKeyDown={e => e.key === 'Enter' && handleCreatePlaylist()} autoFocus
              style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCreatePl(false); setNewPlName('') }} style={{
                padding: '8px 16px', background: 'var(--bg-secondary)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)',
              }}>取消</button>
              <button onClick={handleCreatePlaylist} style={{
                padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#fff', fontWeight: 600,
              }}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
