import api from './api'
import type { Song } from '../types'

/** 同步搜索(一次性返回所有结果) */
export async function search(
  keyword: string,
  sources?: string[],
  page = 1,
  pageSize = 20,
): Promise<{ results: Song[]; total: number; page: number; has_more: boolean }> {
  const { data } = await api.post('/search', { keyword, sources, page, page_size: pageSize })
  return data
}

/** 搜索建议(输入联想) */
export async function getSuggestions(keyword: string): Promise<string[]> {
  const { data } = await api.get('/search/suggestions', { params: { keyword } })
  return data?.suggestions || data || []
}

/** 刷新下载链接(歌曲下载 URL 过期时) */
export async function refreshUrl(song: {
  song_name: string
  singers: string
  source: string
  song_identifier: string
}): Promise<{ download_url: string; cover_url?: string; lyric?: string }> {
  const { data } = await api.post('/refresh-url', song)
  return data
}
