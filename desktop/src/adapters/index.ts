import type { PlatformAdapter } from '@common/adapters'
import { desktopStorage } from './storage'
import { desktopAudio } from './audio'
import { desktopDatabase } from './database'
import { desktopFS } from './filesystem'

export const desktopAdapter: PlatformAdapter = {
  storage: desktopStorage,
  audio: desktopAudio,
  db: desktopDatabase,
  fs: desktopFS,
  platformName: () => 'windows',
}
