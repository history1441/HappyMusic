import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import api from '@common/services/api'
import type { Song } from '@common/types'
import {
  ArrowLeft, RefreshCw, Play, Music, Sparkles, AlertTriangle, Loader2,
} from 'lucide-react'
import { cn } from '../utils/cn'
import { showToast } from '../components/Toast'

/** 带并发上限的 Promise.all 实现 */
async function promisePool<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: (R | undefined)[] = new Array(items.length)
  let currentIndex = 0

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++
      try {
        results[idx] = await fn(items[idx], idx)
      } catch {
        results[idx] = undefined
      }
    }
  })

  await Promise.all(workers)
  return results as R[]
}

interface AIRecommendation {
  song: string
  artist: string
  reason: string
  source?: string
  song_identifier?: string
  cover_url?: string
  ext?: string
  duration_s?: number
  download_url?: string
}

export default function AIRecommendScreen() {
  const navigate = useNavigate()

  const [aiEnabled, setAiEnabled] = useState(false)
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    checkAIStatus()
    loadRecommendations()
  }, [])

  const checkAIStatus = async () => {
    try {
      const { data } = await api.get('/ai/status')
      setAiEnabled(data.enabled !== false)
    } catch {
      setAiEnabled(false)
    }
  }

  const loadRecommendations = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const { data } = await api.get('/ai/recommend')
      const recs: AIRecommendation[] = Array.isArray(data) ? data : data.recommendations || []

      // Try to find playable versions for each recommendation (max 3 concurrent)
      const enriched = await promisePool(
        recs,
        async (rec) => {
          try {
            const { data: searchResult } = await api.post('/search', {
              keyword: `${rec.song} ${rec.artist}`,
            })
            const results = Array.isArray(searchResult) ? searchResult : searchResult.results || []
            if (results.length > 0) {
              const first = results[0]
              return {
                ...rec,
                source: first.source,
                song_identifier: first.song_identifier,
                cover_url: first.cover_url,
                ext: first.ext,
                duration_s: first.duration_s,
                download_url: first.download_url,
              }
            }
          } catch {}
          return rec
        },
        3,
      )

      setRecommendations(enriched)
    } catch (e: any) {
      if (!isRefresh) {
        showToast('获取AI推荐失败', 'error')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handlePlay = (rec: AIRecommendation) => {
    if (!rec.source || !rec.song_identifier) {
      showToast('该歌曲暂无可播放版本', 'error')
      return
    }
    const song: Song = {
      song_name: rec.song,
      singers: rec.artist,
      album: '',
      ext: rec.ext || 'mp3',
      file_size: '',
      duration: '',
      duration_s: rec.duration_s || 0,
      source: rec.source,
      song_identifier: rec.song_identifier,
      download_url: rec.download_url || '',
      cover_url: rec.cover_url || '',
      lyric: '',
      with_valid_download_url: !!rec.download_url,
    }
    showToast(`播放: ${song.song_name}`, 'info')
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
          <button onClick={() => navigate(-1)} className="p-1.5 text-text-secondary hover:text-text transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="flex-1 text-center text-base font-bold text-text">AI 推荐</h1>
          <div className="w-5" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-text-tertiary mt-3">AI 正在分析你的喜好...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 text-text-secondary hover:text-text transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-text">AI 推荐</h1>
        <button
          onClick={() => loadRecommendations(true)}
          className="p-1.5 text-primary hover:opacity-80 transition-opacity"
          disabled={refreshing}
        >
          <RefreshCw size={20} className={cn(refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Warning banner */}
      {!aiEnabled && (
        <div className="flex items-center gap-2 bg-warning/10 px-4 py-2.5 border-b border-warning/20 flex-shrink-0">
          <AlertTriangle size={16} className="text-warning flex-shrink-0" />
          <span className="text-sm text-warning/80">AI 推荐服务未启用，部分功能不可用</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Sparkles size={64} className="text-border" />
            <p className="text-sm text-text-tertiary mt-3 mb-4">暂无AI推荐</p>
            <button
              onClick={() => loadRecommendations()}
              className="px-6 py-2.5 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              重新获取
            </button>
          </div>
        ) : (
          <div className="pb-5">
            {recommendations.map((item, idx) => (
              <div
                key={`${item.song}_${item.artist}_${idx}`}
                className="bg-card mx-4 mt-3 rounded-xl p-4 shadow-sm border border-border-light"
              >
                {/* Card header */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-semibold text-text truncate">{item.song}</p>
                    <p className="text-xs text-text-tertiary truncate">{item.artist}</p>
                  </div>
                  {item.source && item.song_identifier ? (
                    <button
                      onClick={() => handlePlay(item)}
                      className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 hover:bg-primary/90 transition-colors"
                    >
                      <Play size={18} className="text-white ml-0.5" fill="white" />
                    </button>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-border-light flex items-center justify-center flex-shrink-0">
                      <Music size={16} className="text-text-tertiary" />
                    </div>
                  )}
                </div>

                {/* Reason */}
                <div className="flex items-start gap-1.5 bg-border-light/60 rounded-lg p-2.5">
                  <Sparkles size={14} className="text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
