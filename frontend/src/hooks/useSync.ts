import { useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '../stores/playerStore'
import { connectSync, disconnectSync, sendState as sendSyncState } from '@common/services/syncService'

interface SyncMessage {
  type: string
  song?: any
  is_playing?: boolean
  progress?: number
  volume?: number
  play_mode?: string
  action?: string
  params?: any
  timestamp?: number
}

let lastSyncTimestamp = 0

export function useSync() {
  const { currentSong, isPlaying, volume, playMode, resume, pause, next, prev, togglePlay, setVolume } = usePlayerStore()
  const lastSyncRef = useRef<number>(0)

  const handleSyncCommand = useCallback((msg: SyncMessage) => {
    if (msg.type === 'command') {
      switch (msg.action) {
        case 'play':
        case 'resume':
          resume()
          break
        case 'pause':
          pause()
          break
        case 'next':
          next()
          break
        case 'prev':
          prev()
          break
        case 'toggle':
          togglePlay()
          break
        case 'volume':
          if (msg.params?.value !== undefined) setVolume(msg.params.value)
          break
      }
    } else if (msg.type === 'player_state') {
      // 同步其他设备的状态
      if (msg.timestamp && msg.timestamp > lastSyncTimestamp) {
        lastSyncTimestamp = msg.timestamp
        if (msg.song) {
          // 只在歌曲变化时同步
          const currentKey = currentSong ? `${currentSong.source}_${currentSong.song_identifier}` : ''
          const remoteKey = msg.song.source ? `${msg.song.source}_${msg.song.song_identifier}` : ''
          if (currentKey !== remoteKey) {
            // 歌曲不同步，仅更新播放状态
            if (msg.is_playing) resume()
            else pause()
          }
        }
      }
    } else if (msg.type === 'request_state') {
      sendSyncState({
        song: currentSong ? {
          song_name: currentSong.song_name,
          singers: currentSong.singers,
          source: currentSong.source,
        } : undefined,
        is_playing: isPlaying,
        volume: volume,
        play_mode: playMode,
        timestamp: Date.now(),
      })
    }
  }, [currentSong, isPlaying, volume, playMode, resume, pause, next, prev, togglePlay, setVolume])

  useEffect(() => {
    connectSync(handleSyncCommand)
    return () => {
      disconnectSync()
    }
  }, [handleSyncCommand])

  // Sync state changes with deduplication
  useEffect(() => {
    const now = Date.now()
    if (now - lastSyncRef.current > 1000) {
      lastSyncRef.current = now
      sendSyncState({
        song: currentSong ? {
          song_name: currentSong.song_name,
          singers: currentSong.singers,
          source: currentSong.source,
        } : undefined,
        is_playing: isPlaying,
        progress: 0,
        volume: volume,
        play_mode: playMode,
        timestamp: now,
      })
    }
  }, [currentSong, isPlaying, volume, playMode])

  return { isConnected: true }
}
