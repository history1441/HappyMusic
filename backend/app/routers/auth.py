from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.playlist import Playlist, PlaylistSong
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from app.utils.auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user,
)

router = APIRouter(prefix="/api/auth", tags=["认证"])


def _ensure_default_playlists(db: Session, user_id: int):
    fav = db.query(Playlist).filter(Playlist.user_id == user_id, Playlist.is_favorite == True).first()
    if not fav:
        db.add(Playlist(user_id=user_id, name="我喜欢", is_favorite=True))
    recent = db.query(Playlist).filter(Playlist.user_id == user_id, Playlist.name == "最近播放").first()
    if not recent:
        db.add(Playlist(user_id=user_id, name="最近播放"))
    db.commit()


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        nickname=req.username,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _ensure_default_playlists(db, user.id)
    return TokenResponse(
        access_token=create_access_token(user.id, username=user.username),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已被禁用")
    user.last_login_at = datetime.now()
    db.commit()
    return TokenResponse(
        access_token=create_access_token(user.id, user.role, username=user.username),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(refresh: str, db: Session = Depends(get_db)):
    from app.utils.auth import decode_token
    payload = decode_token(refresh)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="无效的Refresh Token")
    user_id = int(payload.get("sub", 0))
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserResponse)
def get_me(user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.put("/change-password")
def change_password(body: dict, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    old_pwd = body.get("old_password", "")
    new_pwd = body.get("new_password", "")
    if not old_pwd or not new_pwd:
        raise HTTPException(status_code=400, detail="旧密码和新密码不能为空")
    if len(new_pwd) < 6:
        raise HTTPException(status_code=400, detail="新密码长度至少6位")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if not verify_password(old_pwd, user.password_hash):
        raise HTTPException(status_code=400, detail="旧密码错误")
    user.password_hash = hash_password(new_pwd)
    db.commit()
    return {"ok": True, "message": "密码修改成功"}


@router.get("/login-history")
def get_login_history(
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.user_audit import UserAuditLog
    logs = db.query(UserAuditLog).filter(
        UserAuditLog.user_id == user_id,
        UserAuditLog.action.in_(("login", "admin_login", "qrcode_scan", "qrcode_login")),
    ).order_by(UserAuditLog.created_at.desc()).limit(50).all()
    return {"logs": [{
        "id": l.id,
        "action": l.action,
        "ip_address": l.ip_address,
        "user_agent": l.user_agent,
        "success": l.success,
        "detail": l.detail,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    } for l in logs]}


@router.get("/favorite-status")
def get_favorite_status(
    song_identifier: str = "",
    source: str = "",
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取歌曲收藏状态 - 轻量级接口，不返回歌单数据"""
    # 查找"我喜欢的"歌单
    fav_playlist = db.query(Playlist).filter(
        Playlist.user_id == user_id,
        Playlist.is_favorite == True,
    ).first()
    if not fav_playlist:
        return {"is_favorite": False, "playlist_id": None}

    result = {"is_favorite": False, "playlist_id": fav_playlist.id}

    # 如果提供了歌曲标识，检查该歌曲是否在收藏中
    if song_identifier and source:
        exists = db.query(PlaylistSong).filter(
            PlaylistSong.playlist_id == fav_playlist.id,
            PlaylistSong.source == source,
            PlaylistSong.song_identifier == song_identifier,
        ).first()
        result["is_favorite"] = exists is not None

    return result
