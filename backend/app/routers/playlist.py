from datetime import datetime
from typing import List, Optional
import re
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.playlist import Playlist, PlaylistSong
from app.schemas.playlist import (
    PlaylistCreate, PlaylistUpdate, PlaylistSongAdd,
    PlaylistResponse, PlaylistSongResponse,
)
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/playlists", tags=["歌单"])


def _get_playlist_or_404(db: Session, playlist_id: int, user_id: int) -> Playlist:
    pl = db.query(Playlist).filter(Playlist.id == playlist_id, Playlist.user_id == user_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="歌单不存在")
    return pl


@router.get("", response_model=list[PlaylistResponse])
def list_playlists(user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    playlists = db.query(Playlist).filter(Playlist.user_id == user_id).order_by(Playlist.created_at.desc()).all()
    if not playlists:
        return []

    playlist_ids = [pl.id for pl in playlists]
    # 批量查询所有歌单歌曲
    songs = db.query(PlaylistSong).filter(
        PlaylistSong.playlist_id.in_(playlist_ids)
    ).order_by(PlaylistSong.playlist_id, PlaylistSong.sort_order).all()

    # 按 playlist_id 分组
    songs_by_playlist: dict[int, list] = {}
    for s in songs:
        songs_by_playlist.setdefault(s.playlist_id, []).append(s)

    result = []
    for pl in playlists:
        pl_songs = songs_by_playlist.get(pl.id, [])
        result.append(PlaylistResponse(
            id=pl.id, name=pl.name, description=pl.description,
            cover=pl.cover, is_favorite=pl.is_favorite,
            song_count=len(pl_songs), created_at=pl.created_at, updated_at=pl.updated_at,
            songs=[PlaylistSongResponse.model_validate(s) for s in pl_songs],
        ))
    return result


@router.get("/{playlist_id}", response_model=PlaylistResponse)
def get_playlist(playlist_id: int, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    pl = _get_playlist_or_404(db, playlist_id, user_id)
    songs = db.query(PlaylistSong).filter(PlaylistSong.playlist_id == pl.id).order_by(PlaylistSong.sort_order).all()
    return PlaylistResponse(
        id=pl.id, name=pl.name, description=pl.description,
        cover=pl.cover, is_favorite=pl.is_favorite,
        song_count=len(songs), created_at=pl.created_at, updated_at=pl.updated_at,
        songs=[PlaylistSongResponse.model_validate(s) for s in songs],
    )


@router.post("", response_model=PlaylistResponse, status_code=status.HTTP_201_CREATED)
def create_playlist(req: PlaylistCreate, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    pl = Playlist(user_id=user_id, name=req.name, description=req.description, is_favorite=req.is_favorite)
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return PlaylistResponse(
        id=pl.id, name=pl.name, description=pl.description,
        cover=pl.cover, is_favorite=pl.is_favorite,
        song_count=0, created_at=pl.created_at, updated_at=pl.updated_at, songs=[],
    )


@router.put("/{playlist_id}", response_model=PlaylistResponse)
def update_playlist(playlist_id: int, req: PlaylistUpdate, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    pl = _get_playlist_or_404(db, playlist_id, user_id)
    if req.name is not None:
        pl.name = req.name
    if req.description is not None:
        pl.description = req.description
    db.commit()
    db.refresh(pl)
    songs = db.query(PlaylistSong).filter(PlaylistSong.playlist_id == pl.id).order_by(PlaylistSong.sort_order).all()
    return PlaylistResponse(
        id=pl.id, name=pl.name, description=pl.description,
        cover=pl.cover, is_favorite=pl.is_favorite,
        song_count=len(songs), created_at=pl.created_at, updated_at=pl.updated_at,
        songs=[PlaylistSongResponse.model_validate(s) for s in songs],
    )


@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_playlist(playlist_id: int, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    pl = _get_playlist_or_404(db, playlist_id, user_id)
    db.delete(pl)
    db.commit()


@router.post("/{playlist_id}/songs", response_model=PlaylistSongResponse, status_code=status.HTTP_201_CREATED)
def add_song(playlist_id: int, req: PlaylistSongAdd, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    pl = _get_playlist_or_404(db, playlist_id, user_id)
    max_order = db.query(PlaylistSong).filter(PlaylistSong.playlist_id == playlist_id).count()
    song = PlaylistSong(
        playlist_id=playlist_id,
        song_name=req.song_name,
        singers=req.singers,
        album=req.album,
        ext=req.ext,
        duration=req.duration,
        file_size=req.file_size,
        source=req.source,
        song_identifier=req.song_identifier,
        lyric=req.lyric,
        cover_url=req.cover_url,
        sort_order=max_order,
    )
    db.add(song)
    db.commit()
    db.refresh(song)
    return song


@router.delete("/{playlist_id}/songs/{song_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_song(playlist_id: int, song_id: int, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    pl = _get_playlist_or_404(db, playlist_id, user_id)
    song = db.query(PlaylistSong).filter(
        PlaylistSong.id == song_id, PlaylistSong.playlist_id == playlist_id
    ).first()
    if not song:
        raise HTTPException(status_code=404, detail="歌曲不存在")
    db.delete(song)
    db.commit()


# ==================== 歌单导入 / 导出 ====================

class _ExportSong(BaseModel):
    song_name: str
    singers: str = ""
    album: str = ""
    ext: str = "mp3"
    duration: int = 0
    file_size: str = ""
    source: str = ""
    song_identifier: str = ""
    lyric: str = ""
    cover_url: str = ""


class _ImportPayload(BaseModel):
    name: Optional[str] = None
    description: str = ""
    songs: List[_ExportSong] = []


class _ImportTextPayload(BaseModel):
    name: str
    text: str
    source: str = "netease"
    description: str = ""


def _parse_playlist_text(text: str, source: str) -> list[dict]:
    """解析主流平台导出的歌单文本(每行一首)为歌曲列表。
    支持格式:
      - 「歌曲名 - 歌手」(网易云默认导出)
      - 「歌手 - 歌曲名」「歌曲名 歌手」「歌曲名\\t歌手」
      - 带行号:「1. 歌曲 - 歌手」「01、歌曲 - 歌手」
    解析不出分隔符时整行作为歌曲名。source 用于播放时取流,song_identifier 用歌名+歌手哈希保证缓存唯一。
    """
    import hashlib
    songs: list[dict] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        # 去除行号前缀: "1. " / "01、" / "1) " / "1 "
        line = re.sub(r'^\d{1,3}[.\)、\s]+', '', line)
        if not line:
            continue
        # 分割:优先 - – —,其次制表符,再次 2+ 空格
        parts = re.split(r'\s*[-–—]\s*|\t+|\s{2,}', line, maxsplit=1)
        song_name = ""
        singers = ""
        if len(parts) == 2:
            a, b = parts[0].strip(), parts[1].strip()
            # 默认按网易云格式:歌名在前;清理歌手尾部的专辑/多余信息(如「歌手 / 专辑」「歌手 album」)
            song_name = a
            singers = re.split(r'\s+[/／]\s+|\s+album[:：]?', b, maxsplit=1)[0].strip()
        else:
            song_name = line
        if not song_name:
            continue
        # 清理尾部括号内容(如「(Live)」「(翻自xx)」保留,但清理纯空白)
        identifier = "txt_" + hashlib.md5(f"{song_name}|{singers}".encode()).hexdigest()[:12]
        songs.append({
            "song_name": song_name[:200],
            "singers": (singers or "未知歌手")[:200],
            "album": "",
            "ext": "mp3",
            "duration": 0,
            "file_size": "",
            "source": source,
            "song_identifier": identifier,
            "lyric": "",
            "cover_url": "",
        })
    return songs


@router.get("/{playlist_id}/export")
def export_playlist(playlist_id: int, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    """导出歌单为可移植 JSON(不含用户/自增 id,便于跨账号迁移与备份)。"""
    pl = _get_playlist_or_404(db, playlist_id, user_id)
    songs = db.query(PlaylistSong).filter(
        PlaylistSong.playlist_id == pl.id
    ).order_by(PlaylistSong.sort_order).all()
    return {
        "name": pl.name,
        "description": pl.description or "",
        "version": 1,
        "exported_at": datetime.utcnow().isoformat(),
        "songs": [
            {
                "song_name": s.song_name,
                "singers": s.singers or "",
                "album": s.album or "",
                "ext": s.ext or "mp3",
                "duration": s.duration or 0,
                "file_size": s.file_size or "",
                "source": s.source or "",
                "song_identifier": s.song_identifier or "",
                "lyric": getattr(s, "lyric", "") or "",
                "cover_url": s.cover_url or "",
            }
            for s in songs
        ],
    }


@router.post("/import", response_model=PlaylistResponse, status_code=status.HTTP_201_CREATED)
def import_playlist(req: _ImportPayload, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    """从 JSON 导入歌单(创建新歌单,不覆盖既有歌单)。"""
    name = (req.name or "导入的歌单").strip() or "导入的歌单"
    pl = Playlist(user_id=user_id, name=name, description=req.description, is_favorite=False)
    db.add(pl)
    db.flush()
    for idx, s in enumerate(req.songs):
        db.add(PlaylistSong(
            playlist_id=pl.id,
            song_name=s.song_name,
            singers=s.singers,
            album=s.album,
            ext=s.ext,
            duration=s.duration,
            file_size=s.file_size,
            source=s.source,
            song_identifier=s.song_identifier,
            lyric=s.lyric,
            cover_url=s.cover_url,
            sort_order=idx,
        ))
    db.commit()
    db.refresh(pl)
    songs = db.query(PlaylistSong).filter(
        PlaylistSong.playlist_id == pl.id
    ).order_by(PlaylistSong.sort_order).all()
    return PlaylistResponse(
        id=pl.id, name=pl.name, description=pl.description, cover=pl.cover,
        is_favorite=pl.is_favorite, song_count=len(songs),
        created_at=pl.created_at, updated_at=pl.updated_at,
        songs=[PlaylistSongResponse.model_validate(s) for s in songs],
    )


@router.post("/import-text", response_model=PlaylistResponse, status_code=status.HTTP_201_CREATED)
def import_playlist_from_text(
    req: _ImportTextPayload,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """从主流音乐平台(网易云/QQ 音乐等)导出的歌单文本导入。
    解析每行为歌曲,创建新歌单;歌曲 source 用于播放取流,song_identifier 用哈希保证缓存唯一,
    播放时 /refresh-url 按歌名匹配真实音源。
    """
    parsed = _parse_playlist_text(req.text, req.source)
    name = (req.name or "导入的歌单").strip() or "导入的歌单"
    pl = Playlist(user_id=user_id, name=name, description=req.description, is_favorite=False)
    db.add(pl)
    db.flush()
    for idx, s in enumerate(parsed):
        db.add(PlaylistSong(
            playlist_id=pl.id,
            song_name=s["song_name"], singers=s["singers"], album=s["album"],
            ext=s["ext"], duration=s["duration"], file_size=s["file_size"],
            source=s["source"], song_identifier=s["song_identifier"],
            lyric=s["lyric"], cover_url=s["cover_url"], sort_order=idx,
        ))
    db.commit()
    db.refresh(pl)
    songs = db.query(PlaylistSong).filter(
        PlaylistSong.playlist_id == pl.id
    ).order_by(PlaylistSong.sort_order).all()
    return PlaylistResponse(
        id=pl.id, name=pl.name, description=pl.description, cover=pl.cover,
        is_favorite=pl.is_favorite, song_count=len(songs),
        created_at=pl.created_at, updated_at=pl.updated_at,
        songs=[PlaylistSongResponse.model_validate(s) for s in songs],
    )
