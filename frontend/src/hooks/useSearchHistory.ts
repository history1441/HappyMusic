const KEY = 'happymusic_search_history'
const MAX = 20

export function getSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function addSearchHistory(keyword: string) {
  const list = getSearchHistory().filter((k) => k !== keyword)
  list.unshift(keyword)
  if (list.length > MAX) list.length = MAX
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function clearSearchHistory() {
  localStorage.removeItem(KEY)
}

export function removeSearchHistory(keyword: string) {
  const list = getSearchHistory().filter((k) => k !== keyword)
  localStorage.setItem(KEY, JSON.stringify(list))
}
