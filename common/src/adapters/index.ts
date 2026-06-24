/**
 * Platform adapter interface — each platform (mobile/desktop) implements this.
 * Injected at app startup via setPlatformAdapter().
 */
import type { Song } from '../types'

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export interface AudioAdapter {
  play(song: Song): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  stop(): Promise<void>
  seekTo(seconds: number): Promise<void>
  getProgress(): Promise<{ position: number; duration: number }>
  getState(): Promise<'idle' | 'playing' | 'paused' | 'buffering'>
  setRate(rate: number): Promise<void>
  onStateChange?: (cb: (state: string) => void) => () => void
  onTrackEnd?: (cb: () => void) => () => void
}

export interface DatabaseAdapter {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>
  execute(sql: string, params?: any[]): Promise<void>
}

export interface FileSystemAdapter {
  getInfo(path: string): Promise<{ exists: boolean; size?: number }>
  readString(path: string): Promise<string>
  writeString(path: string, content: string): Promise<void>
  download(url: string, toPath: string): Promise<string>
  mkdir(path: string): Promise<void>
  documentDir: string
}

export interface PlatformAdapter {
  storage: StorageAdapter
  audio: AudioAdapter
  db: DatabaseAdapter
  fs: FileSystemAdapter
  platformName: () => 'android' | 'ios' | 'windows' | 'mac' | 'web'
}

let _adapter: PlatformAdapter | null = null

export function setPlatformAdapter(adapter: PlatformAdapter) {
  _adapter = adapter
}

export function getAdapter(): PlatformAdapter {
  if (!_adapter) throw new Error('Platform adapter not initialized. Call setPlatformAdapter() at app startup.')
  return _adapter
}
