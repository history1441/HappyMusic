import { getDB } from '../database/schema'

export async function addSearchHistory(keyword: string): Promise<void> {
  const db = await getDB()
  await db.runAsync(
    'INSERT OR REPLACE INTO search_history (keyword, searched_at) VALUES (?, ?)',
    [keyword, Date.now()]
  )
}

export async function getSearchHistory(limit = 20): Promise<string[]> {
  const db = await getDB()
  const rows = await db.getAllAsync<{ keyword: string }>(
    'SELECT keyword FROM search_history ORDER BY searched_at DESC LIMIT ?', [limit]
  )
  return rows.map(r => r.keyword)
}

export async function clearSearchHistory(): Promise<void> {
  const db = await getDB()
  await db.runAsync('DELETE FROM search_history')
}

export async function removeSearchHistory(keyword: string): Promise<void> {
  const db = await getDB()
  await db.runAsync('DELETE FROM search_history WHERE keyword = ?', [keyword])
}
