import { setPlatformAdapter, type PlatformAdapter } from '@common'

/**
 * Web 平台适配器(frontend 管理后台 + 用户端 Web)
 *
 * Tier 1 只实现 storage(主题/认证/token 持久化用 localStorage)。
 * audio/db/fs 在 Web 端有独立实现(frontend 用 Howler.js + IndexedDB + Blob),
 * 不走 PlatformAdapter,这里留空(访问时报错)。
 */
const webAdapter: PlatformAdapter = {
  storage: {
    getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
    setItem: (key: string, value: string) => {
      try { localStorage.setItem(key, value) } catch (e) { console.warn('localStorage.setItem failed', e) }
      return Promise.resolve()
    },
    removeItem: (key: string) => {
      localStorage.removeItem(key)
      return Promise.resolve()
    },
  },

  // Web 端不通过 PlatformAdapter 实现音视频/数据库/文件系统
  // (frontend 有自己的 Howler.js / IndexedDB / Blob 实现)
  audio: new Proxy({}, { get: () => async () => { throw new Error('Web 端 audio 不走 PlatformAdapter') } }) as any,
  db: new Proxy({}, { get: () => async () => { throw new Error('Web 端 db 不走 PlatformAdapter') } }) as any,
  fs: new Proxy({}, { get: () => async () => { throw new Error('Web 端 fs 不走 PlatformAdapter') } }) as any,

  platformName: () => 'web',
}

// 立即注入(import 本模块即生效)
setPlatformAdapter(webAdapter)

export default webAdapter
