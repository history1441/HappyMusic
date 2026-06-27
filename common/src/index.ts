// Types
export * from './types'

// Utils
export {
  formatDuration, formatSize, parseLyric,
  formatFileSize, formatBitrate, formatTimestamp,
  validateEmail, sanitizeFilename, formatNumber,
} from './utils/format'
export {
  SPEED_PRESETS, nextSpeed, formatSpeed,
  TIMER_PRESETS, makeTimerEndTime, isTimerExpired, formatRemaining,
  NO_AB_LOOP, shouldLoopBack, toggleAbPoint, clearAbLoop,
  QUALITY_PRESETS, pickQualityUrl,
} from './utils/playerControls'
export type { AbLoop, QualityId, QualityPreset } from './utils/playerControls'

// Adapters
export { setPlatformAdapter, getAdapter } from './adapters'
export type { PlatformAdapter, StorageAdapter, AudioAdapter, DatabaseAdapter, FileSystemAdapter } from './adapters'

// Stores(三端共用)
export { useThemeStore } from './stores/themeStore'
export type { ThemeMode } from './stores/themeStore'
export { useAuthStore } from './stores/authStore'

// Services
export { default as api, getApiUrl, setApiUrl, loadSavedApiUrl, saveApiUrl, initTokenCache, getCachedAccessToken, getCachedRefreshToken, getCachedUser, setTokenCache, clearTokenCache } from './services/api'
export { reportPlay as reportPlayStats, fetchCloudRecent, getStatsSummary } from './services/statsService'
export { connectSync, sendPlayerState, disconnectSync } from './services/syncService'
export { fetchLyrics } from './services/lyricsService'
export { search, getSuggestions as getSearchSuggestions, refreshUrl } from './services/searchService'
export {
  loadPlaylists, getPlaylistDetail, createPlaylist, deletePlaylist,
  addToPlaylist, removeFromPlaylist, getFavorites,
  exportPlaylist, importPlaylist,
} from './services/playlistService'
export { fetchRecent, reportPlay, syncRecentToCloud } from './services/recentService'
export {
  fetchAnnouncements, getUnreadAnnouncements, setLastSeenId, getLastSeenId,
} from './services/announcementService'
