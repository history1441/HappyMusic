import { getAdapter } from '@common/adapters'

export async function addSearchHistory(keyword: string): Promise<void> {
  const db = getAdapter().db
  await db.execute(
    'INSERT OR REPLACE INTO search_history (keyword, searched_at) VALUES (?, datetime(\'now\', \'localtime\'))',
    [keyword]
  )
}

export async function getSearchHistory(limit = 20): Promise<string[]> {
  const db = getAdapter().db
  const rows = await db.query<{ keyword: string }>(
    'SELECT keyword FROM search_history ORDER BY searched_at DESC LIMIT ?',
    [limit]
  )
  return rows.map(r => r.keyword)
}

export async function clearSearchHistory(): Promise<void> {
  const db = getAdapter().db
  await db.execute('DELETE FROM search_history')
}

export async function removeSearchHistory(keyword: string): Promise<void> {
  const db = getAdapter().db
  await db.execute('DELETE FROM search_history WHERE keyword = ?', [keyword])
}
