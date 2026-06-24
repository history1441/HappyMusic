import TrackPlayer, { Capability } from 'react-native-track-player'
import { resetEndDetection } from './playbackService'

let playerSetup = false

export async function setupPlayer(): Promise<void> {
  if (playerSetup) return
  try {
    await TrackPlayer.setupPlayer()

    // PlaybackService 已在 index.ts 入口注册,这里不再重复调用 registerPlaybackService

    await TrackPlayer.updateOptions({
      progressUpdateEventInterval: 1,
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      compactCapabilities: [
        Capability.SkipToPrevious,
        Capability.Play,
        Capability.SkipToNext,
      ],
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
    })
    playerSetup = true
  } catch (e) {
    console.warn('setupPlayer failed:', e)
  }
}

export function resetPlayerSetup(): void {
  playerSetup = false
  resetEndDetection()
}
