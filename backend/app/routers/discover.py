"""发现模块:歌手 / 专辑详情聚合(基于全局 PlayLog 热度 + 元数据)。
数据来源为 play_logs 表的去重聚合 —— 无需新增音乐库表即可提供可播放的歌曲列表
(歌曲通过 source + song_identifier 经 /api/refresh-url 取流播放)。
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.play_log import PlayLog
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/discover", tags=["发现"])


def _row_to_song(r) -> dict:
    """将 PlayLog 聚合行转为可播放的歌曲 dict(与 SongInfo 字段对齐)。"""
    return {
        "song_name": r.song_name,
        "singers": r.singers,
        "album": r.album or "",
        "ext": "mp3",
        "file_size": "",
        "duration": str(r.duration_s or 0),
        "duration_s": r.duration_s or 0,
        "source": r.source,
        "song_identifier": r.song_identifier,
        "download_url": "",
        "cover_url": r.cover_url or "",
        "lyric": "",
        "with_valid_download_url": False,
        "plays": int(r.plays),
    }


@router.get("/artist")
def artist_detail(
    name: str = Query(..., min_length=1, description="歌手名(模糊匹配)"),
    limit: int = Query(30, ge=1, le=100),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """歌手详情:全局播放热度聚合该歌手的歌曲(按播放次数排序)。"""
    rows = (
        db.query(
            PlayLog.song_name, PlayLog.singers, PlayLog.album, PlayLog.source,
            PlayLog.song_identifier, PlayLog.cover_url, PlayLog.duration_s,
            func.count(PlayLog.id).label("plays"),
        )
        .filter(PlayLog.singers.ilike(f"%{name}%"))
        .group_by(
            PlayLog.song_name, PlayLog.singers, PlayLog.album, PlayLog.source,
            PlayLog.song_identifier, PlayLog.cover_url, PlayLog.duration_s,
        )
        .order_by(func.count(PlayLog.id).desc())
        .limit(limit)
        .all()
    )
    total_plays = db.query(func.count(PlayLog.id)).filter(PlayLog.singers.ilike(f"%{name}%")).scalar() or 0
    unique_listeners = (
        db.query(func.count(func.distinct(PlayLog.user_id)))
        .filter(PlayLog.singers.ilike(f"%{name}%"), PlayLog.user_id.isnot(None))
        .scalar() or 0
    )
    return {
        "name": name,
        "total_plays": int(total_plays),
        "unique_listeners": int(unique_listeners),
        "song_count": len(rows),
        "songs": [_row_to_song(r) for r in rows],
    }


@router.get("/album")
def album_detail(
    name: str = Query(..., min_length=1, description="专辑名(模糊匹配)"),
    limit: int = Query(30, ge=1, le=100),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """专辑详情:全局播放热度聚合该专辑的曲目。"""
    rows = (
        db.query(
            PlayLog.song_name, PlayLog.singers, PlayLog.album, PlayLog.source,
            PlayLog.song_identifier, PlayLog.cover_url, PlayLog.duration_s,
            func.count(PlayLog.id).label("plays"),
        )
        .filter(PlayLog.album.ilike(f"%{name}%"))
        .group_by(
            PlayLog.song_name, PlayLog.singers, PlayLog.album, PlayLog.source,
            PlayLog.song_identifier, PlayLog.cover_url, PlayLog.duration_s,
        )
        .order_by(func.count(PlayLog.id).desc())
        .limit(limit)
        .all()
    )
    total_plays = db.query(func.count(PlayLog.id)).filter(PlayLog.album.ilike(f"%{name}%")).scalar() or 0
    # 取该专辑的代表歌手(出现最多的)
    top_artist_row = (
        db.query(PlayLog.singers, func.count(PlayLog.id).label("c"))
        .filter(PlayLog.album.ilike(f"%{name}%"))
        .group_by(PlayLog.singers)
        .order_by(func.count(PlayLog.id).desc())
        .first()
    )
    return {
        "name": name,
        "artist": top_artist_row[0] if top_artist_row else "",
        "total_plays": int(total_plays),
        "song_count": len(rows),
        "songs": [_row_to_song(r) for r in rows],
    }


@router.get("/similar")
def similar_songs(
    source: str = Query(...),
    song_identifier: str = Query(...),
    limit: int = Query(15, ge=1, le=50),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """相似推荐:基于听过同一首歌的其他用户也听了什么(协同过滤简易版)。"""
    # 找出听过这首歌的其他歌曲(song_identifier),按共现次数排序
    target_users = (
        db.query(PlayLog.user_id)
        .filter(PlayLog.source == source, PlayLog.song_identifier == song_identifier, PlayLog.user_id.isnot(None))
        .distinct()
        .subquery()
    )
    rows = (
        db.query(
            PlayLog.song_name, PlayLog.singers, PlayLog.album, PlayLog.source,
            PlayLog.song_identifier, PlayLog.cover_url, PlayLog.duration_s,
            func.count(PlayLog.id).label("plays"),
        )
        .filter(
            PlayLog.user_id.in_(target_users),
            ~((PlayLog.source == source) & (PlayLog.song_identifier == song_identifier)),
        )
        .group_by(
            PlayLog.song_name, PlayLog.singers, PlayLog.album, PlayLog.source,
            PlayLog.song_identifier, PlayLog.cover_url, PlayLog.duration_s,
        )
        .order_by(func.count(PlayLog.id).desc())
        .limit(limit)
        .all()
    )
    return {"songs": [_row_to_song(r) for r in rows]}
