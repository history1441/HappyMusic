import { useEffect, useCallback } from 'react'
import { connectSync, disconnectSync, sendPlayerState } from '@common/services/syncService'
import { usePlayerStore } from '../stores/playerStore'

export function useDesktopSync() {
  const handleSyncCommand = useCallback((msg: any) => {
    if (msg.type === 'command') {
      const store = usePlayerStore.getState()
      switch (msg.action) {
        case 'play':
        case 'resume':
        case 'pause':
        case 'toggle':
          store.togglePlay()
          break
        case 'next':
          store.next()
          break
        case 'prev':
          store.prev()
          break
        case 'volume':
          if (msg.params?.value !== undefined) store.setVolume(msg.params.value)
          break
      }
    }
  }, [])

  useEffect(() => {
    connectSync(handleSyncCommand)
    return () => {
      disconnectSync()
    }
  }, [handleSyncCommand])

  // Expose sendPlayerState for use in playerStore
  return { sendPlayerState }
}
