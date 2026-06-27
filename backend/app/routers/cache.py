from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.play_log import PlayLog
from app.models.announcement import Announcement
from app.utils.auth import get_current_user
from app.utils.redis import get_cached_search, set_cached_search, get_cached_url, set_cached_url

router = APIRouter(prefix="/api", tags=["全局热搜 & 缓存"])


@router.get("/global-hot")
def global_hot_songs(
    period: str = Query("week", enum=["day", "week", "month", "all"]),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Platform-wide hot songs based on all users' play history."""
    q = db.query(
        PlayLog.song_name, PlayLog.singers,
        PlayLog.source, PlayLog.song_identifier,
        func.count(PlayLog.id).label("plays"),
        func.max(PlayLog.cover_url).label("cover_url"),
    )

    now = datetime.now()
    if period == "day":
        q = q.filter(PlayLog.played_at >= now - timedelta(days=1))
    elif period == "week":
        q = q.filter(PlayLog.played_at >= now - timedelta(weeks=1))
    elif period == "month":
        q = q.filter(PlayLog.played_at >= now - timedelta(days=30))

    rows = q.group_by(
        PlayLog.song_name, PlayLog.singers,
        PlayLog.source, PlayLog.song_identifier,
    ).order_by(func.count(PlayLog.id).desc()).limit(limit).all()

    return [{
        "rank": i + 1,
        "song_name": r[0],
        "singers": r[1],
        "source": r[2],
        "song_identifier": r[3],
        "play_count": r[4],
        "cover_url": r[5] or "",
        "ext": "mp3",
        "duration_s": 0,
    } for i, r in enumerate(rows)]


@router.get("/cache/search")
def get_cached_results(
    keyword: str,
    user_id: int = Depends(get_current_user),
):
    """Get cached search results if available."""
    cached = get_cached_search(keyword)
    if cached:
        return {"cached": True, "results": cached}
    return {"cached": False, "results": []}


@router.get("/cache/url")
def get_cached_download_url(
    source: str,
    song_identifier: str,
    user_id: int = Depends(get_current_user),
):
    """Get cached download URL if available."""
    url = get_cached_url(source, song_identifier)
    if url:
        return {"cached": True, "download_url": url}
    return {"cached": False, "download_url": None}


@router.get("/announcements")
def get_announcements(db: Session = Depends(get_db)):
    """Active announcements for regular users (only published: publish_at 为空或已到发布时间)."""
    now = datetime.now()
    items = db.query(Announcement).filter(
        (Announcement.publish_at.is_(None)) | (Announcement.publish_at <= now)
    ).order_by(
        Announcement.is_pinned.desc(), Announcement.created_at.desc(),
    ).limit(10).all()
    return {"items": [{
        "id": a.id, "title": a.title, "content": a.content,
        "type": a.type, "is_pinned": a.is_pinned,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    } for a in items]}
