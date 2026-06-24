import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Download, RefreshCw, X } from 'lucide-react'
import { showToast } from '../components/Toast'
import { cn } from '../utils/cn'
import api from '@common/services/api'
import type { Song } from '@common/types'
import { invoke } from '@tauri-apps/api/core'
import { appDataDir } from '@tauri-apps/api/path'

interface DownloadTask {
  id: string
  song: Song
  progress: number
  status: 'pending' | 'downloading' | 'done' | 'error'
  error?: string
}

export default function DownloadManagerScreen() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<DownloadTask[]>([])

  useEffect(() => {
    // Tasks are managed in-memory; could be persisted via plugin-store if needed
  }, [])

  const addTask = async (song: Song) => {
    const id = `${song.source}-${song.song_identifier}-${Date.now()}`
    const task: DownloadTask = { id, song, progress: 0, status: 'pending' }
    setTasks(prev => [...prev, task])

    try {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'downloading' } : t))

      let url = song.download_url
      if (!song.with_valid_download_url) {
        const { data } = await api.post('/refresh-url', {
          song_name: song.song_name, singers: song.singers,
          source: song.source, song_identifier: song.song_identifier,
        })
        url = data.download_url || data.url
      }

      if (!url) throw new Error('无可下载链接')

      // Get download directory
      const downloadDir = await appDataDir()
      const safeName = song.song_name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 80)
      const fileName = `${safeName}_${song.source}_${song.song_identifier}.${song.ext || 'mp3'}`
      const filePath = `${downloadDir}\\${fileName}`

      // Real download using Tauri HTTP plugin
      const response = await invoke<number>('download_file', {
        url,
        path: filePath,
      })

      // Simulate progress based on content-length if available
      const totalSize = response as number // total bytes downloaded
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done', progress: 100 } : t))
    } catch (err: any) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'error', error: err.message || '下载失败' } : t))
    }
  }

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const clearDone = () => {
    setTasks(prev => prev.filter(t => t.status !== 'done'))
  }

  const handleClearCompleted = () => {
    const completed = tasks.filter(t => t.status === 'done')
    if (completed.length === 0) {
      showToast('没有已完成的任务', 'info')
      return
    }
    if (window.confirm(`确定要清除 ${completed.length} 个已完成的任务吗？`)) {
      clearDone()
      showToast('已清除', 'success')
    }
  }

  const getStatusText = (status: DownloadTask['status']): string => {
    switch (status) {
      case 'pending': return '等待中'
      case 'downloading': return '下载中'
      case 'done': return '已完成'
      case 'error': return '失败'
      default: return ''
    }
  }

  const getStatusColor = (status: DownloadTask['status']): string => {
    switch (status) {
      case 'pending': return 'text-text-tertiary'
      case 'downloading': return 'text-primary'
      case 'done': return 'text-success'
      case 'error': return 'text-danger'
      default: return 'text-text-tertiary'
    }
  }

  const getProgressBg = (status: DownloadTask['status']): string => {
    switch (status) {
      case 'pending': return 'bg-text-tertiary'
      case 'downloading': return 'bg-primary'
      case 'done': return 'bg-success'
      case 'error': return 'bg-danger'
      default: return 'bg-text-tertiary'
    }
  }

  const completedCount = tasks.filter(t => t.status === 'done').length
  const activeCount = tasks.filter(t => t.status === 'downloading' || t.status === 'pending').length
  const failedCount = tasks.filter(t => t.status === 'error').length

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 text-text-secondary hover:text-text transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-text">下载管理</h1>
        <div className="w-5" />
      </div>

      {tasks.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
          <p className="text-xs text-text-secondary">
            {activeCount > 0 ? `${activeCount} 个下载中` : '无下载任务'}
            {completedCount > 0 ? ` · ${completedCount} 个已完成` : ''}
            {failedCount > 0 ? ` · ${failedCount} 个失败` : ''}
          </p>
          {(completedCount > 0 || failedCount > 0) && (
            <button onClick={handleClearCompleted} className="text-xs text-primary font-medium hover:underline">
              清除已完成
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24">
            <Download size={56} className="text-border" />
            <p className="text-sm text-text-tertiary mt-3">暂无下载任务</p>
            <p className="text-xs text-text-tertiary/60 mt-1">搜索歌曲后点击下载按钮</p>
          </div>
        ) : (
          <div>
            {tasks.map(task => (
              <div key={task.id} className="relative px-4 py-3.5 border-b border-border-light bg-card">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-8">
                    <p className="text-sm font-medium text-text truncate">{task.song.song_name || '未知'}</p>
                    <p className="text-xs text-text-tertiary mt-0.5 truncate">{task.song.singers || '未知歌手'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1 bg-border-light rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-300', getProgressBg(task.status))}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className={cn('text-xs font-medium min-w-[42px]', getStatusColor(task.status))}>
                    {task.status === 'error' ? task.error || '失败' : getStatusText(task.status)}
                  </span>
                  {task.status !== 'done' && (
                    <span className="text-xs text-text-tertiary font-medium min-w-[36px] text-right">{task.progress}%</span>
                  )}
                </div>
                <div className="absolute right-4 top-3.5 flex items-center gap-1">
                  {task.status === 'error' && (
                    <button
                      className="p-1 text-primary hover:bg-primary/10 rounded transition-colors"
                      onClick={() => { removeTask(task.id); addTask(task.song) }}
                    >
                      <RefreshCw size={16} />
                    </button>
                  )}
                  {task.status === 'done' && (
                    <button
                      className="p-1 text-text-tertiary hover:text-text hover:bg-border-light rounded transition-colors"
                      onClick={() => removeTask(task.id)}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
