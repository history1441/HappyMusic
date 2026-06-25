import api from './api'

/** 拉取云端最近播放记录 */
export async function fetchRecent(limit = 50) {
  const { data } = await api.get('/stats/recent', { params: { limit } })
  return data?.recent || data || []
}

/** 上报播放(记录到云端) */
export async function reportPlay(song: {
  song_name: string
  singers: string
  source: string
  song_identifier: string
}, playedDuration = 0): Promise<void> {
  await api.post('/stats/play', {
    song_name: song.song_name,
    singers: song.singers,
    source: song.source,
    song_identifier: song.song_identifier,
    played_duration: playedDuration,
  }).catch(() => {})  // 统计上报失败不阻塞
}

/** 同步本地最近播放到云端(多设备合并) */
export async function syncRecentToCloud(localRecent: any[]): Promise<void> {
  if (!localRecent?.length) return
  await api.post('/stats/recent/sync', { recent: localRecent }).catch(() => {})
}
