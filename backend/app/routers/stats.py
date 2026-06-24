from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, extract
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.play_log import PlayLog
from app.schemas.stats import (
    PlayLogCreate, StatsSummary, RankingItem,
    PreferenceDimension, MonthlyData, AnnualReport,
)
from app.utils.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/api/stats", tags=["统计"])


@router.post("/play")
def record_play(
    log: PlayLogCreate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = PlayLog(
        user_id=user_id,
        song_name=log.song_name,
        singers=log.singers,
        album=log.album,
        source=log.source,
        song_identifier=log.song_identifier,
        duration_s=log.duration_s,
        played_duration=log.played_duration,
        platform=log.platform,
        cover_url=log.cover_url,
    )
    db.add(entry)
    db.commit()
    return {"ok": True}


@router.get("/summary", response_model=StatsSummary)
def get_summary(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total = db.query(func.count(PlayLog.id)).filter(PlayLog.user_id == user_id).scalar() or 0
    total_sec = db.query(func.coalesce(func.sum(PlayLog.played_duration), 0)).filter(PlayLog.user_id == user_id).scalar()
    unique_songs = db.query(func.count(func.distinct(PlayLog.song_identifier))).filter(PlayLog.user_id == user_id).scalar() or 0
    unique_artists = db.query(func.count(func.distinct(PlayLog.singers))).filter(PlayLog.user_id == user_id).scalar() or 0

    top_song = db.query(PlayLog.song_name, func.count(PlayLog.id).label("c"))\
        .filter(PlayLog.user_id == user_id).group_by(PlayLog.song_name).order_by(func.count(PlayLog.id).desc()).first()
    top_artist = db.query(PlayLog.singers, func.count(PlayLog.id).label("c"))\
        .filter(PlayLog.user_id == user_id).group_by(PlayLog.singers).order_by(func.count(PlayLog.id).desc()).first()
    top_source = db.query(PlayLog.source, func.count(PlayLog.id).label("c"))\
        .filter(PlayLog.user_id == user_id).group_by(PlayLog.source).order_by(func.count(PlayLog.id).desc()).first()

    return StatsSummary(
        total_plays=total,
        total_time_hours=round((total_sec or 0) / 3600, 1),
        unique_songs=unique_songs,
        unique_artists=unique_artists,
        top_song=top_song[0] if top_song else None,
        top_artist=top_artist[0] if top_artist else None,
        top_source=top_source[0] if top_source else None,
    )


@router.get("/ranking")
def get_ranking(
    type: str = Query("song", enum=["song", "artist", "source"]),
    limit: int = Query(20, ge=1, le=100),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if type == "artist":
        rows = db.query(PlayLog.singers, func.count(PlayLog.id).label("c"))\
            .filter(PlayLog.user_id == user_id).group_by(PlayLog.singers)\
            .order_by(func.count(PlayLog.id).desc()).limit(limit).all()
        return [RankingItem(name=r[0], count=r[1]) for r in rows]
    elif type == "source":
        rows = db.query(PlayLog.source, func.count(PlayLog.id).label("c"))\
            .filter(PlayLog.user_id == user_id).group_by(PlayLog.source)\
            .order_by(func.count(PlayLog.id).desc()).limit(limit).all()
        return [RankingItem(name=r[0], count=r[1]) for r in rows]
    else:
        rows = db.query(PlayLog.song_name, PlayLog.singers, func.count(PlayLog.id).label("c"))\
            .filter(PlayLog.user_id == user_id).group_by(PlayLog.song_name, PlayLog.singers)\
            .order_by(func.count(PlayLog.id).desc()).limit(limit).all()
        return [RankingItem(name=r[0], count=r[2], extra=r[1]) for r in rows]


@router.get("/preferences", response_model=list[PreferenceDimension])
def get_preferences(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total = db.query(func.count(PlayLog.id)).filter(PlayLog.user_id == user_id).scalar() or 1
    dims = []

    # Source distribution
    source_rows = db.query(PlayLog.source, func.count(PlayLog.id).label("c"))\
        .filter(PlayLog.user_id == user_id).group_by(PlayLog.source).all()
    source_map = {"netease": "网易", "qqmusic": "QQ", "kugou": "酷狗", "kuwo": "酷我", "migu": "咪咕"}
    for s, c in source_rows:
        label = source_map.get(s, s)
        dims.append(PreferenceDimension(label=f"🎵{label}", value=round(c / total * 100, 1)))

    # Artist diversity (top 5 artists share)
    top_artists = db.query(func.count(PlayLog.id).label("c"))\
        .filter(PlayLog.user_id == user_id).group_by(PlayLog.singers)\
        .order_by(func.count(PlayLog.id).desc()).limit(5).all()
    top5_count = sum(r[0] for r in top_artists)
    dims.append(PreferenceDimension(label="🌟 Top5歌手占比", value=round(top5_count / total * 100, 1)))

    # Repeat rate (songs played more than 3 times)
    repeat = db.query(func.count(func.distinct(PlayLog.song_identifier)))\
        .filter(PlayLog.user_id == user_id)\
        .group_by(PlayLog.song_identifier).having(func.count(PlayLog.id) >= 3).count()
    unique = db.query(func.count(func.distinct(PlayLog.song_identifier)))\
        .filter(PlayLog.user_id == user_id).scalar() or 1
    dims.append(PreferenceDimension(label="🔁 重播率", value=round(repeat / unique * 100, 1)))

    # Album preference
    album_count = db.query(func.count(func.distinct(PlayLog.album)))\
        .filter(PlayLog.user_id == user_id, PlayLog.album != "").scalar() or 0
    dims.append(PreferenceDimension(label="💿 专辑覆盖", value=min(100, round(album_count / max(unique, 1) * 100, 1))))

    # Listening activity (how many different days)
    days_active = db.query(func.count(func.distinct(func.date(PlayLog.played_at))))\
        .filter(PlayLog.user_id == user_id).scalar() or 0
    dims.append(PreferenceDimension(label="📅 活跃天数", value=min(100, days_active)))

    return dims


@router.get("/annual-report", response_model=AnnualReport)
def get_annual_report(
    year: int = Query(datetime.now().year),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(PlayLog).filter(PlayLog.user_id == user_id, extract("year", PlayLog.played_at) == year)

    total = q.count()
    total_sec = db.query(func.coalesce(func.sum(PlayLog.played_duration), 0))\
        .filter(PlayLog.user_id == user_id, extract("year", PlayLog.played_at) == year).scalar()
    unique_songs = db.query(func.count(func.distinct(PlayLog.song_identifier)))\
        .filter(PlayLog.user_id == user_id, extract("year", PlayLog.played_at) == year).scalar() or 0
    unique_artists = db.query(func.count(func.distinct(PlayLog.singers)))\
        .filter(PlayLog.user_id == user_id, extract("year", PlayLog.played_at) == year).scalar() or 0

    # Top songs
    top_songs = db.query(PlayLog.song_name, PlayLog.singers, func.count(PlayLog.id).label("c"))\
        .filter(PlayLog.user_id == user_id, extract("year", PlayLog.played_at) == year)\
        .group_by(PlayLog.song_name, PlayLog.singers).order_by(func.count(PlayLog.id).desc()).limit(10).all()

    # Top artists
    top_artists = db.query(PlayLog.singers, func.count(PlayLog.id).label("c"))\
        .filter(PlayLog.user_id == user_id, extract("year", PlayLog.played_at) == year)\
        .group_by(PlayLog.singers).order_by(func.count(PlayLog.id).desc()).limit(10).all()

    # Monthly
    monthly_rows = db.query(
        extract("month", PlayLog.played_at).label("m"),
        func.count(PlayLog.id).label("plays"),
        func.coalesce(func.sum(PlayLog.played_duration), 0).label("sec"),
    ).filter(PlayLog.user_id == user_id, extract("year", PlayLog.played_at) == year)\
        .group_by(extract("month", PlayLog.played_at)).all()
    monthly = [MonthlyData(month=f"{int(r[0]):02d}", plays=r[1], hours=round(r[2] / 3600, 1)) for r in monthly_rows]

    # Source distribution
    source_rows = db.query(PlayLog.source, func.count(PlayLog.id).label("c"))\
        .filter(PlayLog.user_id == user_id, extract("year", PlayLog.played_at) == year)\
        .group_by(PlayLog.source).order_by(func.count(PlayLog.id).desc()).all()
    source_dist = [RankingItem(name=r[0], count=r[1]) for r in source_rows]

    return AnnualReport(
        year=year, total_plays=total, total_hours=round((total_sec or 0) / 3600, 1),
        unique_songs=unique_songs, unique_artists=unique_artists,
        top_songs=[RankingItem(name=r[0], count=r[2], extra=r[1]) for r in top_songs],
        top_artists=[RankingItem(name=r[0], count=r[1]) for r in top_artists],
        monthly=monthly, source_distribution=source_dist,
    )


@router.get("/recent")
def get_recent_plays(
    limit: int = Query(100, ge=1, le=500),
    after: int = Query(0, description="只返回 id > after 的记录"),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(PlayLog).filter(
        PlayLog.user_id == user_id, PlayLog.id > after,
    ).order_by(PlayLog.id.desc()).limit(limit).all()
    return {"items": [{
        "id": r.id,
        "song_name": r.song_name, "singers": r.singers,
        "album": r.album, "source": r.source,
        "song_identifier": r.song_identifier,
        "duration_s": r.duration_s, "played_duration": r.played_duration,
        "played_at": r.played_at.isoformat() if r.played_at else None,
    } for r in rows], "max_id": max((r.id for r in rows), default=0)}
