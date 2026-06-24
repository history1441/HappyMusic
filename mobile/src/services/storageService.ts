import * as FileSystem from 'expo-file-system/legacy'
import { getDB } from '../database/schema'
import { CACHE_EXPIRE_DAYS } from '../utils/constants'

const FILE_DELETE_BATCH = 10
const SQL_PARAM_LIMIT = 500

async function deleteFilesBatched(items: Array<{ id: number; file_path: string }>): Promise<void> {
  for (let i = 0; i < items.length; i += FILE_DELETE_BATCH) {
    const batch = items.slice(i, i + FILE_DELETE_BATCH)
    await Promise.all(batch.map(async (item) => {
      try {
        const info = await FileSystem.getInfoAsync(item.file_path)
        if (info.exists) await FileSystem.deleteAsync(item.file_path)
      } catch {}
    }))
  }
}

async function deleteCacheRowsBatched(db: any, ids: number[]): Promise<void> {
  for (let i = 0; i < ids.length; i += SQL_PARAM_LIMIT) {
    const batch = ids.slice(i, i + SQL_PARAM_LIMIT)
    const placeholders = batch.map(() => '?').join(',')
    await db.runAsync(`DELETE FROM cache WHERE id IN (${placeholders})`, batch)
  }
}

export async function cleanupExpiredCache(): Promise<number> {
  const db = await getDB()
  const expireMs = CACHE_EXPIRE_DAYS * 24 * 60 * 60 * 1000
  const cutoff = Date.now() - expireMs

  const expired = await db.getAllAsync<{ id: number; file_path: string }>(
    'SELECT id, file_path FROM cache WHERE last_played_at < ?', [cutoff]
  )

  if (expired.length === 0) return 0

  await deleteFilesBatched(expired)
  await deleteCacheRowsBatched(db, expired.map(e => e.id))

  return expired.length
}

export async function clearAllCache(): Promise<number> {
  const db = await getDB()
  const allCache = await db.getAllAsync<{ id: number; file_path: string }>('SELECT id, file_path FROM cache')

  await deleteFilesBatched(allCache)
  await db.runAsync('DELETE FROM cache')
  return allCache.length
}

export async function deleteCacheItem(id: number, filePath: string): Promise<void> {
  const db = await getDB()
  try {
    const info = await FileSystem.getInfoAsync(filePath)
    if (info.exists) await FileSystem.deleteAsync(filePath)
  } catch {}
  await db.runAsync('DELETE FROM cache WHERE id = ?', [id])
}

export async function enforceCacheLimit(maxMB: number): Promise<number> {
  if (maxMB <= 0) return 0 // unlimited
  const db = await getDB()
  const maxBytes = maxMB * 1024 * 1024

  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(file_size), 0) as total FROM cache'
  )
  const currentSize = row?.total || 0
  if (currentSize <= maxBytes) return 0

  // 按最早缓存 + 最久未播放排序，删除最旧的
  const toDelete = await db.getAllAsync<{ id: number; file_path: string; file_size: number }>(
    'SELECT id, file_path, file_size FROM cache ORDER BY cached_at ASC, last_played_at ASC'
  )

  let freed = 0
  let count = 0
  const target = currentSize - maxBytes
  const victims: Array<{ id: number; file_path: string }> = []

  for (const item of toDelete) {
    if (freed >= target) break
    victims.push({ id: item.id, file_path: item.file_path })
    freed += item.file_size || 0
    count++
  }

  if (victims.length > 0) {
    await deleteFilesBatched(victims)
    await deleteCacheRowsBatched(db, victims.map(v => v.id))
  }

  return count
}
