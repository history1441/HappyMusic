import * as FileSystem from 'expo-file-system/legacy'
import { NativeModules, Platform } from 'react-native'
import api, { getCachedAccessToken } from './api'
import { getApiUrl, APP_VERSION } from '../utils/constants'

export interface UpdateInfo {
  version: string
  changelog: string
  filename: string
  download_url: string
  file_size: number
}

/** 查询是否有新版本(Android)。 */
export async function checkUpdate(): Promise<UpdateInfo | null> {
  try {
    const { data } = await api.get('/app/releases/latest', { params: { platform: 'android' }, timeout: 8000 })
    if (!data.version) return null
    if (!isNewerVersion(data.version, APP_VERSION)) return null
    return {
      version: data.version,
      changelog: data.changelog || '',
      filename: data.filename || `happymusic-${data.version}.apk`,
      download_url: data.download_url || (data.filename ? `/api/app/releases/download/${data.filename}` : ''),
      file_size: data.file_size || 0,
    }
  } catch {
    return null
  }
}

/**
 * 应用内下载 APK 并触发系统安装(不经过浏览器)。
 * 下载到 cacheDirectory,带进度回调,完成后调用原生 ApkInstaller 拉起安装器。
 */
export async function downloadAndInstall(
  update: UpdateInfo,
  onProgress?: (pct: number) => void
): Promise<void> {
  if (!update.download_url) throw new Error('暂无可用下载地址')

  // 带 Authorization 的下载(release 端点公开,但保留 token 以防鉴权要求)
  const token = getCachedAccessToken()
  const fullUrl = getApiUrl() + update.download_url
  const dest = `${FileSystem.cacheDirectory}${update.filename}`

  // 已存在则先删除,避免复用旧文件
  const info = await FileSystem.getInfoAsync(dest).catch(() => null as any)
  if (info?.exists) await FileSystem.deleteAsync(dest, { idempotent: true })

  const resumable = FileSystem.createDownloadResumable(
    fullUrl,
    dest,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    } as any,
    (data: any) => {
      if (onProgress && data.totalBytesExpectedToWrite > 0) {
        onProgress(data.totalBytesWritten / data.totalBytesExpectedToWrite)
      }
    }
  )
  const result = await resumable.downloadAsync()
  if (!result || !(result as any).uri) throw new Error('下载失败')

  // 触发安装(仅 Android;iOS 无此能力)
  const ApkInstaller = (NativeModules as any).ApkInstaller
  if (Platform.OS === 'android' && ApkInstaller?.installApk) {
    await ApkInstaller.installApk((result as any).uri)
  } else {
    throw new Error('当前平台不支持应用内安装')
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
