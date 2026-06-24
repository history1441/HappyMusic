const DB_NAME = 'happymusic'
const DB_VERSION = 3
const STORE_FILES = 'files'
const STORE_META = 'meta'
const STORE_RECENT = 'recent'
const STORE_LOCAL = 'local'
const STORE_LOCAL_PLAYLISTS = 'localPlaylists'
const STORE_LOCAL_PL_SONGS = 'localPlaylistSongs'

let dbInstance: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_FILES))
        db.createObjectStore(STORE_FILES, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE_META))
        db.createObjectStore(STORE_META, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE_RECENT)) {
        const s = db.createObjectStore(STORE_RECENT, { keyPath: 'id', autoIncrement: true })
        s.createIndex('playedAt', 'playedAt')
      }
      if (!db.objectStoreNames.contains(STORE_LOCAL))
        db.createObjectStore(STORE_LOCAL, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE_LOCAL_PLAYLISTS))
        db.createObjectStore(STORE_LOCAL_PLAYLISTS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE_LOCAL_PL_SONGS)) {
        const s = db.createObjectStore(STORE_LOCAL_PL_SONGS, { keyPath: 'id', autoIncrement: true })
        s.createIndex('playlistId', 'playlistId')
      }
    }
    req.onsuccess = () => { dbInstance = req.result; resolve(dbInstance!) }
    req.onerror = () => reject(req.error)
  })
}

export interface CachedSong { id: string; blob: Blob }

export interface SongMeta {
  id: string; song_name: string; singers: string; album: string
  ext: string; duration: number; source: string; song_identifier: string
  cover_url: string; downloadedAt: number
}

export interface RecentRecord {
  id?: number; song_name: string; singers: string; album: string
  ext: string; duration_s: number; source: string; song_identifier: string
  cover_url: string; lyric: string; playedAt: number
}

export interface LocalSong {
  id: string; name: string; artists: string; album: string
  duration: number; type: string; size: number; addedAt: number
  coverUrl?: string
}

export interface LocalPlaylist {
  id: string; name: string; description: string; coverUrl: string
  createdAt: number; updatedAt: number
}

export interface LocalPlaylistSong {
  id?: number; playlistId: string; songId: string; addedAt: number; sortOrder: number
}

// ===== Audio Metadata =====

export function extractAudioMeta(file: File): Promise<{ duration: number; coverUrl: string }> {
  return new Promise((resolve) => {
    const result = { duration: 0, coverUrl: '' }
    const audio = new Audio()
    const url = URL.createObjectURL(file)
    audio.onloadedmetadata = () => {
      result.duration = audio.duration || 0
      URL.revokeObjectURL(url)
      resolve(result)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(result)
    }
    audio.src = url
  })
}

// ===== Cached Songs =====

export async function saveSong(id: string, blob: Blob, meta: Omit<SongMeta, 'id' | 'downloadedAt'>) {
  const db = await openDB()
  const tx = db.transaction([STORE_FILES, STORE_META], 'readwrite')
  tx.objectStore(STORE_FILES).put({ id, blob })
  tx.objectStore(STORE_META).put({ id, ...meta, downloadedAt: Date.now() })
  return new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}

export async function getSongBlob(id: string): Promise<Blob | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_FILES).objectStore(STORE_FILES).get(id)
    req.onsuccess = () => resolve(req.result?.blob ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function getSongMeta(id: string): Promise<SongMeta | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_META).objectStore(STORE_META).get(id)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function getAllMeta(): Promise<SongMeta[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_META).objectStore(STORE_META).getAll()
    req.onsuccess = () => resolve(req.result ?? [])
    req.onerror = () => reject(req.error)
  })
}

export async function deleteSong(id: string) {
  const db = await openDB()
  const tx = db.transaction([STORE_FILES, STORE_META], 'readwrite')
  tx.objectStore(STORE_FILES).delete(id)
  tx.objectStore(STORE_META).delete(id)
  return new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}

export async function getStorageUsage(): Promise<number> {
  const metas = await getAllMeta()
  let total = 0
  for (const m of metas) {
    const blob = await getSongBlob(m.id)
    if (blob) total += blob.size
  }
  return total
}

// ===== Recent =====

export async function addRecent(song: Omit<RecentRecord, 'id' | 'playedAt'>) {
  const db = await openDB()
  db.transaction(STORE_RECENT, 'readwrite').objectStore(STORE_RECENT).put({ ...song, playedAt: Date.now() })
}

export async function getRecent(limit = 100): Promise<RecentRecord[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_RECENT).objectStore(STORE_RECENT).index('playedAt').openCursor(null, 'prev')
    const results: RecentRecord[] = []
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor && results.length < limit) { results.push(cursor.value); cursor.continue() }
      else resolve(results)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function clearRecent() {
  const db = await openDB()
  db.transaction(STORE_RECENT, 'readwrite').objectStore(STORE_RECENT).clear()
}

export function songId(source: string, identifier: string) {
  return `${source}:${identifier}`
}

// ===== Local Files =====

export async function saveLocalFile(id: string, blob: Blob, meta: Omit<LocalSong, 'id' | 'addedAt'>) {
  const db = await openDB()
  const tx = db.transaction([STORE_FILES, STORE_LOCAL], 'readwrite')
  tx.objectStore(STORE_FILES).put({ id, blob })
  tx.objectStore(STORE_LOCAL).put({ id, ...meta, addedAt: Date.now() })
  return new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}

export async function getLocalSongs(): Promise<LocalSong[]> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_LOCAL)) return []
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_LOCAL).objectStore(STORE_LOCAL).getAll()
    req.onsuccess = () => resolve(req.result ?? [])
    req.onerror = () => reject(req.error)
  })
}

export async function getLocalSongBlob(id: string): Promise<Blob | null> {
  return getSongBlob(id)
}

export async function deleteLocalSong(id: string) {
  const db = await openDB()
  const tx = db.transaction([STORE_FILES, STORE_LOCAL], 'readwrite')
  tx.objectStore(STORE_FILES).delete(id)
  tx.objectStore(STORE_LOCAL).delete(id)
  return new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}

export async function deleteLocalSongs(ids: string[]) {
  const db = await openDB()
  const tx = db.transaction([STORE_FILES, STORE_LOCAL], 'readwrite')
  for (const id of ids) {
    tx.objectStore(STORE_FILES).delete(id)
    tx.objectStore(STORE_LOCAL).delete(id)
  }
  return new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}

export async function updateLocalSongMeta(id: string, updates: Partial<LocalSong>) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const store = db.transaction(STORE_LOCAL, 'readwrite').objectStore(STORE_LOCAL)
    const req = store.get(id)
    req.onsuccess = () => {
      const existing = req.result
      if (existing) store.put({ ...existing, ...updates })
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

// ===== Local Playlists =====

export async function createLocalPlaylist(name: string, description = ''): Promise<LocalPlaylist> {
  const db = await openDB()
  const pl: LocalPlaylist = {
    id: `lpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name, description, coverUrl: '',
    createdAt: Date.now(), updatedAt: Date.now(),
  }
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_LOCAL_PLAYLISTS, 'readwrite').objectStore(STORE_LOCAL_PLAYLISTS).put(pl)
    req.onsuccess = () => resolve(pl)
    req.onerror = () => reject(req.error)
  })
}

export async function getLocalPlaylists(): Promise<LocalPlaylist[]> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_LOCAL_PLAYLISTS)) return []
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_LOCAL_PLAYLISTS).objectStore(STORE_LOCAL_PLAYLISTS).getAll()
    req.onsuccess = () => resolve((req.result ?? []).sort((a: LocalPlaylist, b: LocalPlaylist) => b.createdAt - a.createdAt))
    req.onerror = () => reject(req.error)
  })
}

export async function updateLocalPlaylist(id: string, updates: Partial<LocalPlaylist>) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const store = db.transaction(STORE_LOCAL_PLAYLISTS, 'readwrite').objectStore(STORE_LOCAL_PLAYLISTS)
    const req = store.get(id)
    req.onsuccess = () => {
      const existing = req.result
      if (existing) store.put({ ...existing, ...updates, updatedAt: Date.now() })
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteLocalPlaylist(id: string) {
  const db = await openDB()
  // Delete playlist and its songs
  const tx = db.transaction([STORE_LOCAL_PLAYLISTS, STORE_LOCAL_PL_SONGS], 'readwrite')
  tx.objectStore(STORE_LOCAL_PLAYLISTS).delete(id)
  // Delete all songs in this playlist
  const index = tx.objectStore(STORE_LOCAL_PL_SONGS).index('playlistId')
  const cursorReq = index.openCursor(IDBKeyRange.only(id))
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result
    if (cursor) { cursor.delete(); cursor.continue() }
  }
  return new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}

export async function addSongToLocalPlaylist(playlistId: string, songId: string) {
  const db = await openDB()
  // Check if already added
  const existing = await getLocalPlaylistSongs(playlistId)
  if (existing.some(s => s.songId === songId)) return
  const entry: LocalPlaylistSong = { playlistId, songId, addedAt: Date.now(), sortOrder: existing.length }
  return new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE_LOCAL_PL_SONGS, 'readwrite').objectStore(STORE_LOCAL_PL_SONGS).add(entry)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function removeSongFromLocalPlaylist(entryId: number) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE_LOCAL_PL_SONGS, 'readwrite').objectStore(STORE_LOCAL_PL_SONGS).delete(entryId)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function getLocalPlaylistSongs(playlistId: string): Promise<LocalPlaylistSong[]> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_LOCAL_PL_SONGS)) return []
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_LOCAL_PL_SONGS).objectStore(STORE_LOCAL_PL_SONGS).index('playlistId').getAll(IDBKeyRange.only(playlistId))
    req.onsuccess = () => resolve((req.result ?? []).sort((a: LocalPlaylistSong, b: LocalPlaylistSong) => a.sortOrder - b.sortOrder))
    req.onerror = () => reject(req.error)
  })
}

export async function getLocalPlaylistWithSongs(playlistId: string): Promise<{ playlist: LocalPlaylist | null; songs: (LocalPlaylistSong & { meta: LocalSong | null })[] }> {
  const [plList, plSongs] = await Promise.all([getLocalPlaylists(), getLocalPlaylistSongs(playlistId)])
  const playlist = plList.find(p => p.id === playlistId) || null
  const allLocal = await getLocalSongs()
  const localMap = new Map(allLocal.map(s => [s.id, s]))
  const songs = plSongs.map(ps => ({ ...ps, meta: localMap.get(ps.songId) || null }))
  return { playlist, songs }
}
