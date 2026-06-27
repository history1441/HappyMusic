import { invoke } from '@tauri-apps/api/core'
import { tempDir, sep } from '@tauri-apps/api/path'
import { getApiUrl, getCachedAccessToken } from '@common/services/api'
import { showToast } from '../components/Toast'

const CURRENT_VERSION = __APP_VERSION__

declare const __APP_VERSION__: string

export interface UpdateInfo {
  version: string
  changelog: string
  download_url: string
  filename: string
  file_size: number
}

/** 查询是否有新版本,返回 UpdateInfo 或 null。 */
export async function checkUpdate(): Promise<UpdateInfo | null> {
  try {
    const token = getCachedAccessToken()
    const res = await fetch(`${getApiUrl()}/api/app/releases/latest?platform=desktop`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return null
    const data = await res.json()
    const remoteVersion = data.version || data.tag_name
    if (!remoteVersion || !isNewerVersion(remoteVersion, CURRENT_VERSION)) return null
    return {
      version: remoteVersion,
      changelog: data.changelog || '',
      download_url: data.download_url || (data.filename ? `/api/app/releases/download/${data.filename}` : ''),
      filename: data.filename || `happymusic-${remoteVersion}.exe`,
      file_size: data.file_size || 0,
    }
  } catch {
    return null
  }
}

/** 应用内更新:下载安装器到临时目录,然后用系统默认程序打开(启动安装)。全程不经过浏览器。 */
export async function downloadAndInstall(update: UpdateInfo): Promise<void> {
  if (!update.download_url) {
    showToast('暂无可用下载地址', 'error')
    return
  }
  showToast('正在下载更新,请稍候…', 'info')
  const tmp = await tempDir()
  const dir = tmp.replace(new RegExp(sep + '+$'), '')
  const dest = `${dir}${sep}${update.filename}`
  const url = getApiUrl() + update.download_url
  await invoke<number>('download_file', { url, path: dest })
  showToast('下载完成,正在启动安装程序', 'success')
  await invoke('open_file', { path: dest })
}

/** 启动后自动检查:有新版本则弹窗确认后下载安装。 */
export async function checkForUpdate() {
  const upd = await checkUpdate()
  if (!upd) return
  const ok = window.confirm(`发现新版本 v${upd.version}\n\n${upd.changelog || '建议更新到最新版本。'}\n\n是否立即下载并安装?`)
  if (!ok) return
  try {
    await downloadAndInstall(upd)
  } catch (e: any) {
    showToast(`更新失败: ${e?.message || e}`, 'error')
  }
}

function isNewerVersion(remote: string, current: string): boolean {
  const r = remote.replace(/^v/, '').split('.').map(Number)
  const c = current.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (c[i] || 0)) return true
    if ((r[i] || 0) < (c[i] || 0)) return false
  }
  return false
}
