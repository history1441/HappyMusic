import TrackPlayer, { Event, State } from 'react-native-track-player'

// ====== 歌曲结束检测状态 ======
// 核心思路：Android ExoPlayer 在队列模式下不会触发 State.Ended，
// 只会触发 PlaybackActiveTrackChanged。通过进度阈值标记"自然结束"，
// 在 track 变化时判断是否为自然播放完成。

// 用版本号追踪歌曲切换，避免竞态
let currentSongVersion = 0
let isNaturalEnd = false
let endHandled = false
let gameModeActive = false

// 监听器幂等注册:防止 registerPlaybackService 多次调用导致监听器累积
let registered = false
let subscriptions: Array<{ remove: () => void }> = []

export function setGameMode(active: boolean) {
  gameModeActive = active
}

export function resetEndDetection() {
  // 每次切歌递增版本号，旧事件的版本号检查会失败
  currentSongVersion++
  isNaturalEnd = false
  endHandled = false
}

export function markManualSkip() {
  // 手动切歌也递增版本号
  currentSongVersion++
  isNaturalEnd = false
  endHandled = false
}

function doNext() {
  if (endHandled) return
  endHandled = true
  const { usePlayerStore } = require('../stores/playerStore')

  // 安慰语音触发检查
  try {
    const { useComfortStore } = require('../stores/comfortStore')
    const comfortStore = useComfortStore.getState()
    if (comfortStore.enabled) {
      const shouldTrigger = comfortStore.recordSongPlayed()
      if (shouldTrigger) {
        comfortStore.resetCounter()
        // 异步触发，不阻塞切歌
        require('../services/ttsService').playComfort().catch(() => {})
      }
    }
  } catch {}

  usePlayerStore.getState().next().catch(() => {})
}

export const PlaybackService = async function () {
  // 幂等守卫:RNTP 在 index.ts 和 audioService.ts 都可能调用 registerPlaybackService,
  // 这里保证监听器只挂载一次
  if (registered) return
  registered = true

  // ====== 远程控制（通知栏/蓝牙/耳机按钮） ======
  subscriptions.push(
    TrackPlayer.addEventListener(Event.RemotePause, () => {
      TrackPlayer.pause()
    })
  )

  subscriptions.push(
    TrackPlayer.addEventListener(Event.RemotePlay, () => {
      TrackPlayer.play()
    })
  )

  subscriptions.push(
    TrackPlayer.addEventListener(Event.RemoteNext, () => {
      markManualSkip()
      const { usePlayerStore } = require('../stores/playerStore')
      usePlayerStore.getState().next()
    })
  )

  subscriptions.push(
    TrackPlayer.addEventListener(Event.RemotePrevious, () => {
      markManualSkip()
      const { usePlayerStore } = require('../stores/playerStore')
      usePlayerStore.getState().prev()
    })
  )

  subscriptions.push(
    TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
      TrackPlayer.seekTo(position)
    })
  )

  // ====== 进度更新（每秒触发，由 progressUpdateEventInterval 控制） ======
  subscriptions.push(
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, ({ position, duration }) => {
      if (gameModeActive) return
      const { usePlayerStore } = require('../stores/playerStore')
      const songVer = currentSongVersion // 快照当前版本号

      // 更新 UI 进度
      if (duration > 0) {
        usePlayerStore.setState({ position, duration })
      }

      // 自然结束检测：进度接近末尾 → 设置标记
      if (duration > 0 && position >= duration - 1 && position > 0) {
        // 只在当前歌曲版本未变时标记，防止旧歌曲的进度误触发
        if (currentSongVersion === songVer) {
          isNaturalEnd = true
        }
      }
    })
  )

  // ====== 播放状态变化 ======
  subscriptions.push(
    TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
      if (gameModeActive) return
      const { usePlayerStore } = require('../stores/playerStore')
      const songVer = currentSongVersion

      if (state === State.Playing) {
        usePlayerStore.setState({ isBuffering: false, isPlaying: true })
      } else if (state === State.Paused) {
        usePlayerStore.setState({ isPlaying: false })
      } else if (state === State.Buffering) {
        usePlayerStore.setState({ isBuffering: true })
      } else if (state === State.Ended) {
        // 只有当前歌曲版本未变时才处理
        if (currentSongVersion === songVer && !endHandled && isNaturalEnd) {
          doNext()
        }
      }
    })
  )

  // ====== 活动轨道变化 ======
  subscriptions.push(
    TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, ({ track }) => {
      if (gameModeActive) return
      const songVer = currentSongVersion
      // 只有当版本号未变（即不是我们主动切歌导致的）且是自然结束时才触发 doNext
      // 如果是 resetEndDetection/markManualSkip 递增了版本号，说明是新歌曲开始了
      if (!track && isNaturalEnd && !endHandled && currentSongVersion === songVer) {
        doNext()
      }
    })
  )

  // ====== 队列结束 ======
  subscriptions.push(
    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
      if (gameModeActive) return
      const ver = currentSongVersion // Snapshot version
      if (!endHandled && currentSongVersion === ver) {
        doNext()
      }
    })
  )

  // ====== 播放错误 ======
  subscriptions.push(
    TrackPlayer.addEventListener(Event.PlaybackError, (data) => {
      console.warn('PlaybackError:', data)
      const { usePlayerStore } = require('../stores/playerStore')
      usePlayerStore.setState({ isPlaying: false, isBuffering: false })
      const { showToast } = require('../components/Toast')
      showToast('播放出错，请稍后重试')
    })
  )
}

export function cleanupPlaybackListeners() {
  for (const sub of subscriptions) {
    try { sub.remove() } catch {}
  }
  subscriptions = []
  registered = false
}
