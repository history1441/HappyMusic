"""用户数据管理:数据导出(可移植性/隐私)+ 账号注销。
导出聚合用户档案、歌单(含歌曲)、统计摘要、最近播放,客户端可下载为 JSON 备份。
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.play_log import PlayLog
from app.models.playlist import Playlist, PlaylistSong
from app.utils.auth import get_current_user, pwd_context

router = APIRouter(prefix="/api/users/me", tags=["用户数据"])


@router.get("/export")
def export_my_data(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """导出当前用户全部数据(JSON):档案 + 歌单(含歌曲)+ 统计摘要 + 最近 200 条播放记录。"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 歌单 + 歌曲
    playlists = db.query(Playlist).filter(Playlist.user_id == user_id).all()
    playlist_ids = [p.id for p in playlists]
    songs = (
        db.query(PlaylistSong)
        .filter(PlaylistSong.playlist_id.in_(playlist_ids))
        .order_by(PlaylistSong.playlist_id, PlaylistSong.sort_order)
        .all()
        if playlist_ids else []
    )
    songs_by_pl: dict[int, list] = {}
    for s in songs:
        songs_by_pl.setdefault(s.playlist_id, []).append({
            "song_name": s.song_name, "singers": s.singers, "album": s.album,
            "ext": s.ext, "duration": s.duration, "source": s.source,
            "song_identifier": s.song_identifier, "cover_url": s.cover_url,
        })

    # 统计摘要
    total_plays = db.query(func.count(PlayLog.id)).filter(PlayLog.user_id == user_id).scalar() or 0
    total_sec = db.query(func.coalesce(func.sum(PlayLog.played_duration), 0)).filter(PlayLog.user_id == user_id).scalar()
    unique_songs = db.query(func.count(func.distinct(PlayLog.song_identifier))).filter(PlayLog.user_id == user_id).scalar() or 0
    unique_artists = db.query(func.count(func.distinct(PlayLog.singers))).filter(PlayLog.user_id == user_id).scalar() or 0

    # 最近播放
    recent = (
        db.query(PlayLog)
        .filter(PlayLog.user_id == user_id)
        .order_by(PlayLog.played_at.desc())
        .limit(200)
        .all()
    )

    return {
        "exported_at": datetime.now().isoformat(),
        "user": {
            "username": user.username,
            "nickname": user.nickname,
            "avatar": user.avatar,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "stats_summary": {
            "total_plays": int(total_plays),
            "total_time_hours": round((total_sec or 0) / 3600, 1),
            "unique_songs": int(unique_songs),
            "unique_artists": int(unique_artists),
        },
        "playlists": [{
            "name": p.name,
            "description": p.description,
            "is_favorite": p.is_favorite,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "songs": songs_by_pl.get(p.id, []),
        } for p in playlists],
        "recent_plays": [{
            "song_name": r.song_name, "singers": r.singers, "album": r.album,
            "source": r.source, "played_duration": r.played_duration,
            "played_at": r.played_at.isoformat() if r.played_at else None,
        } for r in recent],
    }


@router.delete("/delete")
def delete_my_account(
    password: str,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """注销账号:需校验密码。级联删除歌单;播放记录 user_id 置空(保留匿名统计)。"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if not pwd_context.verify(password, user.password_hash):
        raise HTTPException(status_code=400, detail="密码不正确")

    # 播放记录解除关联(保留匿名数据用于全局统计)
    db.query(PlayLog).filter(PlayLog.user_id == user_id).update({PlayLog.user_id: None})
    # 歌单级联删除(Playlist.user_id ON DELETE CASCADE)
    db.query(Playlist).filter(Playlist.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    return {"ok": True, "message": "账号已注销"}
