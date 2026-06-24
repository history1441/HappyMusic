from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta
from app.database import get_db
from app.models.user import User
from app.models.play_log import PlayLog
from app.utils.auth import get_admin_user

router = APIRouter(prefix="/api/admin", tags=["数据分析"])


@router.get("/analytics/overview")
def analytics_overview(admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    now = datetime.now()
    total_users = db.query(func.count(User.id)).scalar()
    new_today = db.query(func.count(User.id)).filter(User.created_at >= now - timedelta(days=1)).scalar()
    new_week = db.query(func.count(User.id)).filter(User.created_at >= now - timedelta(weeks=1)).scalar()
    new_month = db.query(func.count(User.id)).filter(User.created_at >= now - timedelta(days=30)).scalar()
    total_plays = db.query(func.count(PlayLog.id)).scalar()
    plays_today = db.query(func.count(PlayLog.id)).filter(PlayLog.played_at >= now - timedelta(days=1)).scalar()
    active_users = db.query(func.count(func.distinct(PlayLog.user_id))).filter(
        PlayLog.played_at >= now - timedelta(days=7)
    ).scalar()
    return {
        "total_users": total_users, "new_today": new_today,
        "new_week": new_week, "new_month": new_month,
        "total_plays": total_plays, "plays_today": plays_today,
        "active_users_7d": active_users,
    }


@router.get("/analytics/play-stats")
def play_stats(
    days: int = Query(30, ge=1, le=365),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    since = datetime.now() - timedelta(days=days)
    rows = db.query(
        func.date(PlayLog.played_at).label("date"),
        func.count(PlayLog.id).label("plays"),
    ).filter(PlayLog.played_at >= since).group_by(func.date(PlayLog.played_at)).order_by(text("date")).all()
    return [{"date": str(r[0]), "plays": r[1]} for r in rows]


@router.get("/analytics/source-distribution")
def source_distribution(admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    since = datetime.now() - timedelta(days=30)
    rows = db.query(
        PlayLog.source, func.count(PlayLog.id).label("count"),
    ).filter(PlayLog.played_at >= since).group_by(PlayLog.source).order_by(func.count(PlayLog.id).desc()).all()
    return [{"source": r[0] or "unknown", "count": r[1]} for r in rows]


@router.get("/analytics/user-growth")
def user_growth(
    days: int = Query(30, ge=1, le=365),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    since = datetime.now() - timedelta(days=days)
    rows = db.query(
        func.date(User.created_at).label("date"),
        func.count(User.id).label("count"),
    ).filter(User.created_at >= since).group_by(func.date(User.created_at)).order_by(text("date")).all()
    return [{"date": str(r[0]), "count": r[1]} for r in rows]


@router.get("/analytics/peak-hours")
def peak_hours(admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    since = datetime.now() - timedelta(days=30)
    rows = db.query(
        func.extract("hour", PlayLog.played_at).label("hour"),
        func.extract("dow", PlayLog.played_at).label("dow"),
        func.count(PlayLog.id).label("count"),
    ).filter(PlayLog.played_at >= since).group_by(
        func.extract("hour", PlayLog.played_at),
        func.extract("dow", PlayLog.played_at),
    ).all()
    return [{"hour": int(r[0]), "dow": int(r[1]), "count": r[2]} for r in rows]


@router.get("/analytics/top-songs")
def top_songs(
    limit: int = Query(20, ge=1, le=100),
    days: int = Query(30, ge=1),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    since = datetime.now() - timedelta(days=days)
    rows = db.query(
        PlayLog.song_name, PlayLog.singers,
        func.count(PlayLog.id).label("plays"),
    ).filter(PlayLog.played_at >= since).group_by(PlayLog.song_name, PlayLog.singers)\
     .order_by(func.count(PlayLog.id).desc()).limit(limit).all()
    return [{"song_name": r[0], "singers": r[1], "plays": r[2]} for r in rows]


@router.get("/analytics/top-artists")
def top_artists(
    limit: int = Query(20, ge=1, le=100),
    days: int = Query(30, ge=1),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    since = datetime.now() - timedelta(days=days)
    rows = db.query(
        PlayLog.singers, func.count(PlayLog.id).label("plays"),
    ).filter(PlayLog.played_at >= since).group_by(PlayLog.singers)\
     .order_by(func.count(PlayLog.id).desc()).limit(limit).all()
    return [{"artist": r[0], "plays": r[1]} for r in rows]


@router.get("/analytics/platform-distribution")
def platform_distribution(
    days: int = Query(30, ge=1),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    since = datetime.now() - timedelta(days=days)
    rows = db.query(
        PlayLog.platform, func.count(PlayLog.id).label("count"),
    ).filter(PlayLog.played_at >= since).group_by(PlayLog.platform).all()
    return [{"platform": r[0] or "unknown", "count": r[1]} for r in rows]
