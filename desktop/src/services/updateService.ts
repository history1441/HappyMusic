import { getApiUrl, getCachedAccessToken } from '@common/services/api'
import { showToast } from '../components/Toast'

const CURRENT_VERSION = __APP_VERSION__

declare const __APP_VERSION__: string

export async function checkForUpdate() {
  try {
    const token = getCachedAccessToken()
    const res = await fetch(`${getApiUrl()}/api/app/releases/latest?platform=desktop`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return

    const data = await res.json()
    const remoteVersion = data.version || data.tag_name
    if (!remoteVersion) return

    if (isNewerVersion(remoteVersion, CURRENT_VERSION)) {
      const downloadUrl = data.download_url || data.assets?.[0]?.url
      const msg = downloadUrl
        ? `发现新版本 v${remoteVersion}，${data.changelog || '建议更新'}`
        : `发现新版本 v${remoteVersion}，请前往下载`
      showToast(msg, 'info')
    }
  } catch {}
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
