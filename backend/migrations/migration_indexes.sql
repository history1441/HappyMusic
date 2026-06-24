-- HappyMusic 性能优化数据库迁移脚本
-- 执行方式: mysql -u happymusic -phappymusic_pass_2026 happymusic < migration_indexes.sql

-- PlayLog 复合索引 - 加速统计查询
CREATE INDEX IF NOT EXISTS idx_playlog_user_played ON play_logs (user_id, played_at);
CREATE INDEX IF NOT EXISTS idx_playlog_user_song ON play_logs (user_id, song_identifier);
CREATE INDEX IF NOT EXISTS idx_playlog_user_source ON play_logs (user_id, source);

-- PlaylistSong 索引 - 加速歌单查询
-- playlist_id 已有外键索引，确认存在
-- CREATE INDEX IF NOT EXISTS idx_playlist_song_playlist ON playlist_songs (playlist_id);

-- 更新统计查询性能
-- 年度报表、播放排行等查询将受益于新索引
