import * as SQLite from 'expo-sqlite'

const DB_NAME = 'happymusic'

let db: SQLite.SQLiteDatabase | null = null

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME)
    await migrate(db)
  }
  return db
}

async function migrate(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_name TEXT NOT NULL,
      singers TEXT NOT NULL,
      album TEXT DEFAULT '',
      ext TEXT DEFAULT 'mp3',
      duration REAL DEFAULT 0,
      source TEXT NOT NULL,
      song_identifier TEXT NOT NULL,
      cover_url TEXT DEFAULT '',
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      downloaded_at INTEGER NOT NULL,
      UNIQUE(source, song_identifier)
    );

    CREATE TABLE IF NOT EXISTS cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_name TEXT NOT NULL,
      singers TEXT NOT NULL,
      album TEXT DEFAULT '',
      ext TEXT DEFAULT 'mp3',
      duration REAL DEFAULT 0,
      source TEXT NOT NULL,
      song_identifier TEXT NOT NULL,
      cover_url TEXT DEFAULT '',
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      cached_at INTEGER NOT NULL,
      last_played_at INTEGER NOT NULL,
      UNIQUE(source, song_identifier)
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlist_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      song_source TEXT NOT NULL,
      song_identifier TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      added_at INTEGER NOT NULL,
      UNIQUE(playlist_id, song_source, song_identifier)
    );

    CREATE TABLE IF NOT EXISTS recent_plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_name TEXT NOT NULL,
      singers TEXT NOT NULL,
      album TEXT DEFAULT '',
      ext TEXT DEFAULT 'mp3',
      duration_s REAL DEFAULT 0,
      source TEXT NOT NULL,
      song_identifier TEXT NOT NULL,
      cover_url TEXT DEFAULT '',
      lyric TEXT DEFAULT '',
      played_at INTEGER NOT NULL,
      synced INTEGER DEFAULT 0,
      UNIQUE(source, song_identifier)
    );

    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL UNIQUE,
      searched_at INTEGER NOT NULL
    );
  `)
}

export async function resetDB() {
  if (db) {
    await db.closeAsync()
    await SQLite.deleteDatabaseAsync(DB_NAME)
    db = null
  }
}
