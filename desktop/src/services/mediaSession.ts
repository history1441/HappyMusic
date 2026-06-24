import { usePlayerStore } from '../stores/playerStore'

export function initMediaSession() {
  if (!('mediaSession' in navigator)) return

  navigator.mediaSession.setActionHandler('play', () => {
    usePlayerStore.getState().togglePlay()
  })

  navigator.mediaSession.setActionHandler('pause', () => {
    usePlayerStore.getState().togglePlay()
  })

  navigator.mediaSession.setActionHandler('previoustrack', () => {
    usePlayerStore.getState().prev()
  })

  navigator.mediaSession.setActionHandler('nexttrack', () => {
    usePlayerStore.getState().next()
  })

  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime !== undefined) {
      usePlayerStore.getState().seekTo(details.seekTime)
    }
  })
}
