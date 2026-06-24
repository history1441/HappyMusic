import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, PlusCircle, Music, Trash2, FolderOpen, Loader2 } from 'lucide-react'
import { showToast } from '../components/Toast'
import { formatSize } from '@common/utils/format'
import { getAdapter } from '@common/adapters'
import { addToDownloads, removeDownload } from '../services/cacheService'

interface ImportedFile {
  song_name: string
  singers: string
  album: string
  ext: string
  duration: number
  source: string
  song_identifier: string
  cover_url: string
  file_path: string
  file_size: number
}

export default function LocalFileImportScreen() {
  const navigate = useNavigate()
  const [files, setFiles] = useState<ImportedFile[]>([])
  const [importing, setImporting] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadFiles = async () => {
    setLoading(true)
    try {
      const db = getAdapter().db
      const rows = await db.query<ImportedFile>(
        "SELECT * FROM downloads WHERE source = 'local' ORDER BY downloaded_at DESC"
      )
      setFiles(rows)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadFiles() }, [])

  const handlePickFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'] }],
      })

      if (!selected) return

      const filesList = Array.isArray(selected) ? selected : [selected]
      setImporting(true)
      let importedCount = 0

      for (const filePath of filesList) {
        try {
          const filename = filePath.split(/[\\/]/).pop() || 'unknown.mp3'
          const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
          const ext = filename.split('.').pop()?.toLowerCase() || 'mp3'
          const identifier = `local_${nameWithoutExt.replace(/[^a-zA-Z0-9一-鿿]/g, '_')}_${Date.now()}`

          await addToDownloads({
            song_name: nameWithoutExt, singers: '本地导入', album: '', ext,
            duration: 0, source: 'local', song_identifier: identifier,
            cover_url: '', file_path: filePath, file_size: 0,
          })
          importedCount++
        } catch (e) {
          console.error('Failed to import file:', e)
        }
      }

      await loadFiles()
      showToast(`成功导入 ${importedCount} 个文件`, 'success')
    } catch {
      handleFallbackPick()
    } finally {
      setImporting(false)
    }
  }

  const handleFallbackPick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'audio/*'
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return
      setImporting(true)
      let importedCount = 0

      for (const file of Array.from(input.files)) {
        try {
          const nameWithoutExt = file.name.replace(/\.[^.]+$/, '')
          const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3'
          const identifier = `local_${nameWithoutExt.replace(/[^a-zA-Z0-9一-鿿]/g, '_')}_${Date.now()}`

          await addToDownloads({
            song_name: nameWithoutExt, singers: '本地导入', album: '', ext,
            duration: 0, source: 'local', song_identifier: identifier,
            cover_url: '', file_path: file.name, file_size: file.size,
          })
          importedCount++
        } catch (e) {
          console.error('Failed to import file:', e)
        }
      }

      await loadFiles()
      showToast(`成功导入 ${importedCount} 个文件`, 'success')
      setImporting(false)
    }
    input.click()
  }

  const handleDelete = async (file: ImportedFile) => {
    if (!window.confirm(`确定要删除 "${file.song_name}" 吗？`)) return
    try {
      await removeDownload(file.source, file.song_identifier)
      setFiles(prev => prev.filter(f => f.song_identifier !== file.song_identifier))
      showToast('已删除', 'success')
    } catch {
      showToast('删除失败', 'error')
    }
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1 text-text hover:text-primary transition-colors">
          <ArrowLeft size={22} />
        </button>
        <span className="text-lg font-bold">本地导入</span>
        <div className="w-6" />
      </div>

      <button
        onClick={handlePickFile}
        disabled={importing}
        className="flex items-center justify-center gap-2 mx-4 mt-4 py-3.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors flex-shrink-0"
      >
        {importing ? <Loader2 size={20} className="animate-spin" /> : <PlusCircle size={20} />}
        {importing ? '导入中...' : '选择文件'}
      </button>

      {importing && <p className="text-center text-xs text-text-tertiary mt-2">正在导入文件...</p>}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto mt-2">
          {files.length > 0 ? (
            files.map((file) => (
              <div key={file.song_identifier} className="flex items-center px-4 py-3 bg-card border-b border-border-light">
                <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center mr-3 flex-shrink-0">
                  <Music size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{file.song_name}</p>
                  <p className="text-xs text-text-tertiary">{file.ext.toUpperCase()} · {formatSize(file.file_size)}</p>
                </div>
                <button onClick={() => handleDelete(file)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center pt-20">
              <FolderOpen size={56} className="text-border" />
              <p className="text-sm text-text-tertiary mt-3">暂无导入文件</p>
              <p className="text-xs text-border mt-1">点击上方按钮选择音频文件导入</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
