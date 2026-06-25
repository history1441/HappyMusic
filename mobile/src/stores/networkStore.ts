import { create } from 'zustand'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'

interface NetworkState {
  isOnline: boolean
  connectionType: string  // wifi | cellular | none | unknown
  /** 初始化网络监听,返回 cleanup 函数(在 unmount 时调用) */
  init: () => () => void
}

let unsubscribe: (() => void) | null = null

function updateFromState(state: NetInfoState) {
  useNetworkStore.setState({
    isOnline: state.isConnected ?? false,
    connectionType: state.type,
  })
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,  // 乐观初始化,避免首屏闪烁离线提示
  connectionType: 'unknown',
  init: () => {
    if (unsubscribe) return unsubscribe  // 已初始化,返回现有 cleanup

    unsubscribe = NetInfo.addEventListener(updateFromState)

    // 同步获取一次当前状态(避免监听器延迟)
    NetInfo.fetch().then(updateFromState).catch(() => {})

    const cleanup = () => {
      unsubscribe?.()
      unsubscribe = null
    }
    return cleanup
  },
}))
