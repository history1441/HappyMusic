"""外键级联删除测试

验证 P0-2 修复的级联策略:
- Playlist.user_id CASCADE:用户删除 → 歌单删除
- PlaylistSong.playlist_id CASCADE:歌单删除 → 歌曲关联删除
- GameScore.user_id CASCADE:用户删除 → 分数删除
- PlayLog.user_id SET NULL:用户删除 → 播放记录保留,user_id 置 NULL
"""
from app.models.user import User
from app.models.playlist import Playlist, PlaylistSong
from app.models.game_score import GameScore
from app.models.play_log import PlayLog
from app.utils.auth import hash_password


def test_cascade_delete_user(db_session):
    """删用户后,关联数据按策略级联处理"""
    # 准备数据:用户 + 歌单 + 歌单曲目 + 游戏分数 + 播放记录
    user = User(username="cascade_user", password_hash=hash_password("pass123"))
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    playlist = Playlist(user_id=user.id, name="我的歌单", is_favorite=False)
    db_session.add(playlist)
    db_session.commit()
    db_session.refresh(playlist)

    song = PlaylistSong(
        playlist_id=playlist.id,
        song_name="测试歌曲", singers="歌手", source="netease",
        song_identifier="song_001", sort_order=0,
    )
    db_session.add(song)

    score = GameScore(user_id=user.id, score=100, difficulty="normal")
    db_session.add(score)

    log = PlayLog(
        user_id=user.id, song_name="歌曲", singers="歌手",
        source="netease", song_identifier="song_001",
    )
    db_session.add(log)
    db_session.commit()

    # 记录 ID 用于后续断言
    playlist_id = playlist.id
    song_id = song.id
    score_id = score.id
    log_id = log.id

    # 执行删除用户
    db_session.delete(user)
    db_session.commit()

    # 验证 Playlist 级联删除(CASCADE)
    assert db_session.query(Playlist).filter_by(id=playlist_id).first() is None, \
        "Playlist 应随用户级联删除"

    # 验证 PlaylistSong 级联删除(随 Playlist)
    assert db_session.query(PlaylistSong).filter_by(id=song_id).first() is None, \
        "PlaylistSong 应随歌单级联删除"

    # 验证 GameScore 级联删除(CASCADE)
    assert db_session.query(GameScore).filter_by(id=score_id).first() is None, \
        "GameScore 应随用户级联删除(CASCADE)"

    # 验证 PlayLog.user_id 置 NULL(SET NULL,记录保留)
    log_after = db_session.query(PlayLog).filter_by(id=log_id).first()
    assert log_after is not None, "PlayLog 记录应保留(匿名化)"
    assert log_after.user_id is None, "PlayLog.user_id 应为 NULL(SET NULL)"


def test_delete_playlist_cascade_songs(db_session, test_user):
    """删歌单后,PlaylistSong 级联删除"""
    playlist = Playlist(user_id=test_user.id, name="临时歌单", is_favorite=False)
    db_session.add(playlist)
    db_session.commit()
    db_session.refresh(playlist)

    song = PlaylistSong(
        playlist_id=playlist.id,
        song_name="歌", singers="手", source="qq",
        song_identifier="s1", sort_order=0,
    )
    db_session.add(song)
    db_session.commit()
    song_id = song.id

    db_session.delete(playlist)
    db_session.commit()

    assert db_session.query(PlaylistSong).filter_by(id=song_id).first() is None
