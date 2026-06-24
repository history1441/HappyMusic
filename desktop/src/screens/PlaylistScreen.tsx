import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import type { Playlist } from '@common/types'
import { loadPlaylistsCached, refreshPlaylists, createPlaylist, deletePlaylist, updatePlaylist } from '../services/playlistService'
import { CirclePlus, Heart, Trash2, X, Loader2 } from 'lucide-react'
import { showToast } from '../components/Toast'
import { cn } from '../utils/cn'

export default function PlaylistScreen() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [editPl, setEditPl] = useState<Playlist | null>(null)
  const [editName, setEditName] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    ;(async () => {
      const cached = await loadPlaylistsCached()
      if (cached.length > 0) setPlaylists(cached)
      setLoading(false)

      // Background refresh
      const remote = await refreshPlaylists()
      if (remote.length > 0 || cached.length === 0) {
        setPlaylists(remote)
      }
    })()
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const pl = await createPlaylist(newName.trim())
    if (pl) {
      setShowCreate(false)
      setNewName('')
      setPlaylists(prev => [pl, ...prev])
      showToast('歌单已创建', 'success')
    } else {
      showToast('创建失败', 'error')
    }
  }

  const handleDelete = async (pl: Playlist) => {
    if (!window.confirm(`确定删除 "${pl.name}"？`)) return
    const ok = await deletePlaylist(pl.id)
    if (ok) {
      setPlaylists(prev => prev.filter(p => p.id !== pl.id))
      showToast('已删除', 'success')
    }
  }

  const handleEdit = async () => {
    if (!editPl || !editName.trim()) return
    const ok = await updatePlaylist(editPl.id, editName.trim())
    if (ok) {
      setPlaylists(prev => prev.map(p => p.id === editPl.id ? { ...p, name: editName.trim() } : p))
      showToast('已保存', 'success')
    }
    setEditPl(null)
    setEditName('')
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-primary text-sm font-medium hover:opacity-80 transition-opacity"
        >
          <CirclePlus size={18} />
          <span>新建歌单</span>
        </button>
        <div className="flex-1" />
      </div>

      {/* Playlist list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : playlists.length === 0 ? (
          <p className="text-center text-text-tertiary mt-10 text-sm">暂无歌单</p>
        ) : (
          playlists.map(item => (
            <div
              key={item.id}
              className="flex items-center px-4 py-3 bg-card border-b border-border-light hover:bg-border-light transition-colors cursor-pointer group"
              onClick={() => navigate(`/playlist/${item.id}`, { state: { name: item.name } })}
              onContextMenu={(e) => {
                e.preventDefault()
                setEditPl(item)
                setEditName(item.name)
              }}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0',
                  item.is_favorite ? 'bg-red-500' : 'bg-primary'
                )}
              >
                {item.is_favorite ? (
                  <Heart size={22} className="text-white" fill="white" />
                ) : (
                  <span className="text-white text-xl font-bold">{item.name[0]}</span>
                )}
              </div>

              <div className="flex-1 ml-3 min-w-0">
                <p className="text-sm font-medium text-text truncate">{item.name}</p>
                <p className="text-xs text-text-tertiary mt-0.5">{item.song_count} 首</p>
              </div>

              {!item.is_favorite && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(item) }}
                  className="p-2 text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                  title="删除歌单"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowCreate(false); setNewName('') }} />
          <div className="relative bg-card rounded-2xl p-5 w-[90%] max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-text">新建歌单</h3>
              <button onClick={() => { setShowCreate(false); setNewName('') }} className="text-text-tertiary hover:text-text">
                <X size={18} />
              </button>
            </div>
            <input
              type="text"
              placeholder="歌单名称"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowCreate(false); setNewName('') }} className="px-4 py-2 text-sm text-text-secondary hover:text-text transition-colors">取消</button>
              <button onClick={handleCreate} className="px-5 py-2 text-sm text-white bg-primary rounded-lg font-medium hover:bg-primary/90 transition-colors">创建</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editPl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditPl(null)} />
          <div className="relative bg-card rounded-2xl p-5 w-[90%] max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-text">编辑歌单</h3>
              <button onClick={() => setEditPl(null)} className="text-text-tertiary hover:text-text">
                <X size={18} />
              </button>
            </div>
            <input
              type="text"
              placeholder="歌单名称"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEdit()}
              autoFocus
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditPl(null)} className="px-4 py-2 text-sm text-text-secondary hover:text-text transition-colors">取消</button>
              <button onClick={handleEdit} className="px-5 py-2 text-sm text-white bg-primary rounded-lg font-medium hover:bg-primary/90 transition-colors">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
