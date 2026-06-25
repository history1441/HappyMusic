import api from './api'
import { getAdapter } from '../adapters'
import type { Announcement } from '../types'

const LAST_SEEN_KEY = 'announcement_last_seen_id'

/** 拉取所有公告 */
export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data } = await api.get('/announcements')
  return data?.announcements || data || []
}

/** 获取未读公告(对比本地 last_seen_id) */
export async function getUnreadAnnouncements(): Promise<Announcement[]> {
  const all = await fetchAnnouncements()
  const lastSeen = await getLastSeenId()
  return all.filter((a) => a.id > lastSeen)
}

/** 标记已读(记录最后看到的公告 ID) */
export async function setLastSeenId(id: number): Promise<void> {
  await getAdapter().storage.setItem(LAST_SEEN_KEY, String(id))
}

/** 获取本地记录的最后已读 ID */
export async function getLastSeenId(): Promise<number> {
  const raw = await getAdapter().storage.getItem(LAST_SEEN_KEY)
  return raw ? parseInt(raw, 10) || 0 : 0
}
