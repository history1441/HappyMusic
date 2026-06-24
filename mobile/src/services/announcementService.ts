import api from './api'
import * as FileSystem from 'expo-file-system/legacy'

const LAST_SEEN_FILE = FileSystem.documentDirectory + 'last_announcement.json'

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
  try {
    const info = await FileSystem.getInfoAsync(LAST_SEEN_FILE)
    if (!info.exists) return 0
    const content = await FileSystem.readAsStringAsync(LAST_SEEN_FILE)
    const data = JSON.parse(content)
    return data.last_id || 0
  } catch {
    return 0
  }
}

export async function setLastSeenId(id: number): Promise<void> {
  await FileSystem.writeAsStringAsync(LAST_SEEN_FILE, JSON.stringify({ last_id: id }))
}

export async function getUnreadAnnouncements(): Promise<Announcement[]> {
  const [announcements, lastId] = await Promise.all([fetchAnnouncements(), getLastSeenId()])
  return announcements.filter(a => a.id > lastId)
}
