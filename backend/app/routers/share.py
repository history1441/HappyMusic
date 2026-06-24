from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.share import Share
from app.models.playlist import Playlist, PlaylistSong
from app.schemas.share import ShareCreate, ShareResponse, ShareImport
from app.schemas.playlist import PlaylistResponse, PlaylistSongResponse
from app.utils.auth import get_current_user
from app.utils.music import generate_share_code
from app.config import get_settings

router = APIRouter(prefix="/api/share", tags=["分享"])
settings = get_settings()


@router.post("", response_model=ShareResponse)
def create_share(req: ShareCreate, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    pl = db.query(Playlist).filter(Playlist.id == req.playlist_id, Playlist.user_id == user_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="歌单不存在")
    code = generate_share_code(settings.SHARE_CODE_LENGTH)
    while db.query(Share).filter(Share.share_code == code).first():
        code = generate_share_code(settings.SHARE_CODE_LENGTH)
    share = Share(
        playlist_id=pl.id,
        user_id=user_id,
        share_code=code,
        expire_at=datetime.now() + timedelta(days=settings.SHARE_EXPIRE_DAYS),
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    song_count = db.query(PlaylistSong).filter(PlaylistSong.playlist_id == pl.id).count()
    return ShareResponse(
        share_code=code, playlist_name=pl.name,
        song_count=song_count, created_at=share.created_at, expire_at=share.expire_at,
    )


@router.get("/{code}", response_model=PlaylistResponse)
def get_share(code: str, db: Session = Depends(get_db)):
    share = db.query(Share).filter(Share.share_code == code).first()
    if not share:
        raise HTTPException(status_code=404, detail="分享码不存在")
    if share.expire_at and share.expire_at < datetime.now():
        raise HTTPException(status_code=410, detail="分享已过期")
    pl = db.query(Playlist).filter(Playlist.id == share.playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="歌单不存在")
    songs = db.query(PlaylistSong).filter(PlaylistSong.playlist_id == pl.id).order_by(PlaylistSong.sort_order).all()
    return PlaylistResponse(
        id=pl.id, name=pl.name, description=pl.description,
        cover=pl.cover, is_favorite=pl.is_favorite,
        song_count=len(songs), created_at=pl.created_at, updated_at=pl.updated_at,
        songs=[PlaylistSongResponse.model_validate(s) for s in songs],
    )


@router.post("/{code}/import", response_model=PlaylistResponse, status_code=status.HTTP_201_CREATED)
def import_share(code: str, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    share = db.query(Share).filter(Share.share_code == code).first()
    if not share:
        raise HTTPException(status_code=404, detail="分享码不存在")
    if share.expire_at and share.expire_at < datetime.now():
        raise HTTPException(status_code=410, detail="分享已过期")
    src_pl = db.query(Playlist).filter(Playlist.id == share.playlist_id).first()
    if not src_pl:
        raise HTTPException(status_code=404, detail="歌单不存在")
    new_pl = Playlist(
        user_id=user_id,
        name=f"{src_pl.name}（导入）",
        description=src_pl.description,
    )
    db.add(new_pl)
    db.flush()
    src_songs = db.query(PlaylistSong).filter(PlaylistSong.playlist_id == src_pl.id).order_by(PlaylistSong.sort_order).all()
    for s in src_songs:
        new_song = PlaylistSong(
            playlist_id=new_pl.id,
            song_name=s.song_name, singers=s.singers, album=s.album,
            ext=s.ext, duration=s.duration, source=s.source,
            song_identifier=s.song_identifier, lyric=s.lyric,
            cover_url=s.cover_url, sort_order=s.sort_order,
        )
        db.add(new_song)
    db.commit()
    db.refresh(new_pl)
    songs = db.query(PlaylistSong).filter(PlaylistSong.playlist_id == new_pl.id).order_by(PlaylistSong.sort_order).all()
    return PlaylistResponse(
        id=new_pl.id, name=new_pl.name, description=new_pl.description,
        cover=new_pl.cover, is_favorite=new_pl.is_favorite,
        song_count=len(songs), created_at=new_pl.created_at, updated_at=new_pl.updated_at,
        songs=[PlaylistSongResponse.model_validate(s) for s in songs],
    )
