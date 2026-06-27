import { useEffect, useRef } from 'react'
import { useAlarmStore } from '../stores/alarmStore'
import { usePlayerStore } from '../stores/playerStore'
import api from '../services/api'
import type { Song } from '../types'

const DAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function pad(n: number) { return n.toString().padStart(2, '0') }

/**
 * 闹钟检查器:每 10 秒检查一次,匹配当前 HH:MM + 周几 则触发。
 * 按「id+HH:MM」去重,同一分钟只触发一次。触发时播放指定歌曲(或收藏/最近第一首)+ 浏览器通知。
 */
export function useAlarmChecker() {
  const lastFired = useRef<Set<string>>(new Set())

  useEffect(() => {
    // 请求通知权限(静默失败)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    const check = async () => {
      const now = new Date()
      const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`
      const day = now.getDay()
      const alarms = useAlarmStore.getState().alarms

      for (const a of alarms) {
        if (!a.enabled || a.time !== hhmm) continue
        // 周几匹配(空数组=每天)
        if (a.days.length > 0 && !a.days.includes(day)) continue
        const fireKey = `${a.id}|${hhmm}`
        if (lastFired.current.has(fireKey)) continue
        lastFired.current.add(fireKey)
        triggerAlarm(a.label, a.song)
      }

      // 清理过期的去重记录(保留最近 2 分钟)
      if (lastFired.current.size > 50) {
        const cutoff = `${pad(now.getHours())}:${pad(Math.max(0, now.getMinutes() - 2))}`
        lastFired.current = new Set([...lastFired.current].filter((k) => k.split('|')[1] >= cutoff))
      }
    }

    check()
    const id = setInterval(check, 10000)
    return () => clearInterval(id)
  }, [])
}

async function triggerAlarm(label: string, song: Song | null) {
  // 浏览器通知
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('⏰ HappyMusic 闹钟', { body: label || '该起床听歌啦!', tag: 'alarm' })
    }
  } catch {}

  let toPlay: Song | null = song
  // 未指定歌曲:取收藏第一首,否则最近第一首
  if (!toPlay) {
    try {
      const { data } = await api.get('/playlists')
      const fav = (data || []).find((p: any) => p.is_favorite)
      const s = fav?.songs?.[0]
      if (s) {
        toPlay = {
          song_name: s.song_name, singers: s.singers, album: s.album,
          ext: s.ext, file_size: '', duration: '', duration_s: s.duration,
          source: s.source, song_identifier: s.song_identifier,
          download_url: '', cover_url: s.cover_url, lyric: '', with_valid_download_url: false,
        }
      }
    } catch {}
  }

  if (toPlay) {
    usePlayerStore.getState().play(toPlay)
  }
}

export { DAY_LABELS }
