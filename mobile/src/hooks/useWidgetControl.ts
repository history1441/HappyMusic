import { useEffect } from 'react'
import { NativeModules, DeviceEventEmitter } from 'react-native'
import { usePlayerStore } from '../stores/playerStore'

/**
 * 桌面小组件控制桥接:
 *  - 冷启动:getInitialAction() 读取 widget 带来的启动动作
 *  - 热启动:监听 "WidgetControl" 事件(widget 按钮经 MainActivity.onNewIntent 透传)
 *  - 反向:当前歌曲/播放状态变化时调用 updateWidget() 刷新小组件显示
 * 动作:prev / toggle / next
 */
export function useWidgetControl() {
  const currentSong = usePlayerStore(s => s.currentSong)
  const isPlaying = usePlayerStore(s => s.isPlaying)

  // 处理 widget 控制动作
  useEffect(() => {
    const WidgetControl = NativeModules.WidgetControl
    if (!WidgetControl) return

    const handle = (action: string) => {
      const s = usePlayerStore.getState()
      if (action === 'prev') s.prev()
      else if (action === 'next') s.next()
      else if (action === 'toggle') s.togglePlay()
    }

    // 冷启动:读取并消费 initial action
    if (WidgetControl.getInitialAction) {
      WidgetControl.getInitialAction().then((action: string | null) => {
        if (action) handle(action)
      }).catch(() => {})
    }

    // 热启动:监听事件
    const sub = DeviceEventEmitter.addListener('WidgetControl', (action: string) => {
      if (action) handle(action)
    })

    return () => { sub.remove() }
  }, [])

  // 反向刷新小组件显示
  useEffect(() => {
    const WidgetControl = NativeModules.WidgetControl
    if (!WidgetControl?.updateWidget) return
    WidgetControl.updateWidget(
      currentSong?.song_name || '',
      currentSong?.singers || '',
      !!isPlaying
    ).catch(() => {})
  }, [currentSong?.song_identifier, isPlaying])
}
