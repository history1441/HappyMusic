import api from '@common/services/api'
import { desktopStorage } from '../adapters/storage'

export interface Announcement {
  id: number
  title: string
  content: string
  type: 'info' | 'warning' | 'update'
  is_pinned: boolean
  created_at: string
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  try {
    const { data } = await api.get('/announcements', { timeout: 5000 })
    return data.items || []
  } catch {
    return []
  }
}

export async function getLastSeenId(): Promise<number> {
  const val = await desktopStorage.getItem('last_announcement_id')
  return val ? Number(val) : 0
}

export async function setLastSeenId(id: number): Promise<void> {
  await desktopStorage.setItem('last_announcement_id', String(id))
}

export async function getUnreadAnnouncements(): Promise<Announcement[]> {
  const [announcements, lastId] = await Promise.all([fetchAnnouncements(), getLastSeenId()])
  return announcements.filter(a => a.id > lastId)
}
