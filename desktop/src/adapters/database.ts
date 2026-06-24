import type { DatabaseAdapter } from '@common/adapters'
import Database from '@tauri-apps/plugin-sql'

let db: Database | null = null

async function getDB(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:happymusic.db')
    await initSchema(db)
  }
  return db
}

async function initSchema(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS downloads (
      source TEXT NOT NULL,
      song_identifier TEXT NOT NULL,
      song_name TEXT NOT NULL,
      singers TEXT NOT NULL,
      album TEXT DEFAULT '',
      ext TEXT DEFAULT '',
      duration REAL DEFAULT 0,
      cover_url TEXT DEFAULT '',
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      downloaded_at TEXT DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (source, song_identifier)
    );
    CREATE TABLE IF NOT EXISTS cache (
      source TEXT NOT NULL,
      song_identifier TEXT NOT NULL,
      song_name TEXT NOT NULL,
      singers TEXT NOT NULL,
      album TEXT DEFAULT '',
      ext TEXT DEFAULT '',
      duration REAL DEFAULT 0,
      cover_url TEXT DEFAULT '',
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      last_played_at TEXT DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (source, song_identifier)
    );
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      is_favorite INTEGER DEFAULT 0,
      song_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS playlist_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      song_name TEXT NOT NULL,
      singers TEXT NOT NULL,
      album TEXT DEFAULT '',
      ext TEXT DEFAULT '',
      duration REAL DEFAULT 0,
      source TEXT NOT NULL,
      song_identifier TEXT NOT NULL,
      cover_url TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      added_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS recent_plays (
      source TEXT NOT NULL,
      song_identifier TEXT NOT NULL,
      song_name TEXT NOT NULL,
      singers TEXT NOT NULL,
      album TEXT DEFAULT '',
      ext TEXT DEFAULT '',
      duration REAL DEFAULT 0,
      cover_url TEXT DEFAULT '',
      played_at TEXT DEFAULT (datetime('now', 'localtime')),
      synced INTEGER DEFAULT 0,
      PRIMARY KEY (source, song_identifier)
    );
    CREATE TABLE IF NOT EXISTS search_history (
      keyword TEXT PRIMARY KEY,
      searched_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `)
}

export const desktopDatabase: DatabaseAdapter = {
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const d = await getDB()
    const rows = await d.select<T[]>(sql, params)
    return rows
  },
  async execute(sql: string, params?: unknown[]): Promise<void> {
    const d = await getDB()
    await d.execute(sql, params)
  },
}
