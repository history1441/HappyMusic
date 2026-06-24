import { Howl } from 'howler'
import type { AudioAdapter } from '@common/adapters'
import type { Song } from '@common/types'

let howl: Howl | null = null
let audioNode: HTMLAudioElement | null = null
let currentSrc = ''
let stateChangeCallbacks: ((state: string) => void)[] = []
let trackEndCallbacks: (() => void)[] = []

function notifyState(state: string) {
  stateChangeCallbacks.forEach(cb => cb(state))
}

function getAudioEl(): HTMLAudioElement | null {
  if (audioNode) return audioNode
  if (!howl) return null
  // Howler html5 mode stores the Audio element on the first sound
  const sounds = (howl as any)._sounds
  if (sounds && sounds.length > 0 && sounds[0]._node) {
    audioNode = sounds[0]._node as HTMLAudioElement
    return audioNode
  }
  return null
}

export const desktopAudio: AudioAdapter = {
  async play(song: Song): Promise<void> {
    const url = song.download_url || song.with_valid_download_url
      ? song.download_url
      : undefined
    if (!url) throw new Error('No playback URL')

    if (howl) {
      howl.unload()
    }

    audioNode = null
    currentSrc = url
    notifyState('buffering')

    howl = new Howl({
      src: [url],
      html5: true,
      volume: 1,
      onload: () => {
        notifyState('playing')
      },
      onplay: () => {
        notifyState('playing')
      },
      onpause: () => {
        notifyState('paused')
      },
      onstop: () => {
        notifyState('idle')
      },
      onend: () => {
        notifyState('idle')
        trackEndCallbacks.forEach(cb => cb())
      },
      onloaderror: () => {
        notifyState('idle')
      },
    })

    howl.play()

    // Media Session API for system media keys
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.song_name,
        artist: song.singers,
        album: song.album || undefined,
        artwork: song.cover_url ? [{ src: song.cover_url, sizes: '512x512', type: 'image/jpeg' }] : undefined,
      })
    }
  },

  async pause(): Promise<void> {
    howl?.pause()
  },

  async resume(): Promise<void> {
    howl?.play()
  },

  async stop(): Promise<void> {
    howl?.stop()
  },

  async seekTo(seconds: number): Promise<void> {
    howl?.seek(seconds)
  },

  async getProgress(): Promise<{ position: number; duration: number }> {
    if (!howl) return { position: 0, duration: 0 }
    // Prefer native Audio element for accurate streaming progress
    const el = getAudioEl()
    if (el && isFinite(el.currentTime) && el.currentTime > 0) {
      return {
        position: el.currentTime,
        duration: isFinite(el.duration) ? el.duration : howl.duration(),
      }
    }
    return {
      position: howl.seek() as number,
      duration: howl.duration(),
    }
  },

  async getState(): Promise<'idle' | 'playing' | 'paused' | 'buffering'> {
    if (!howl) return 'idle'
    if (howl.playing()) return 'playing'
    return 'paused'
  },

  async setRate(rate: number): Promise<void> {
    howl?.rate(rate)
  },

  onStateChange(cb: (state: string) => void): () => void {
    stateChangeCallbacks.push(cb)
    return () => {
      stateChangeCallbacks = stateChangeCallbacks.filter(c => c !== cb)
    }
  },

  onTrackEnd(cb: () => void): () => void {
    trackEndCallbacks.push(cb)
    return () => {
      trackEndCallbacks = trackEndCallbacks.filter(c => c !== cb)
    }
  },
}

export function setAudioVolume(vol: number) {
  if (!howl) return
  howl.volume(Math.max(0, Math.min(1, vol)))
}

export function getAudioVolume(): number {
  if (!howl) return 1
  try {
    return howl.volume()
  } catch {
    return 1
  }
}
