import { Audio } from 'expo-av'
import { TrackPlayer } from 'react-native-track-player'
import api from './api'
import * as FileSystem from 'expo-file-system/legacy'
import { showToast } from '../components/Toast'
import { useComfortStore } from '../stores/comfortStore'

let comfortSound: Audio.Sound | null = null

export async function playComfort(): Promise<void> {
  try {
    // 1. 获取安慰文案
    const voice = useComfortStore.getState().voice
    const { data } = await api.post('/ai/comfort', { voice }, { timeout: 15000 })
    if (!data.text) return

    showToast(data.text)

    // 2. 优先使用后端 TTS 音频
    if (data.audio_url) {
      const audioUrl = `${api.defaults.baseURL}${data.audio_url}`
      const localPath = `${FileSystem.cacheDirectory}comfort_tts.mp3`

      // 下载音频
      const downloadResult = await FileSystem.downloadAsync(audioUrl, localPath)
      if (downloadResult.uri) {
        // 降低音乐音量
        await TrackPlayer.setVolume(0.1)

        // 播放 TTS
        const { sound } = await Audio.Sound.createAsync({ uri: downloadResult.uri })
        comfortSound = sound
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            restoreVolume()
            sound.unloadAsync()
            comfortSound = null
          }
        })
        await sound.playAsync()
        return
      }
    }

    // 3. 后备：使用 expo-speech
    try {
      const Speech = require('expo-speech')
      await TrackPlayer.setVolume(0.1)
      Speech.speak(data.text, {
        language: 'zh-CN',
        pitch: 1.0,
        rate: 0.9,
        onDone: () => restoreVolume(),
        onStopped: () => restoreVolume(),
      })
    } catch {
      restoreVolume()
    }
  } catch {
    // 静默失败
  }
}

async function restoreVolume() {
  try {
    await TrackPlayer.setVolume(1.0)
  } catch {}
}

export async function stopComfort() {
  if (comfortSound) {
    try {
      await comfortSound.stopAsync()
      await comfortSound.unloadAsync()
      comfortSound = null
      await restoreVolume()
    } catch {}
  }
}
