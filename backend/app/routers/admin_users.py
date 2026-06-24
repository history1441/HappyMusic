from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.play_log import PlayLog
from app.models.playlist import Playlist
from app.schemas.admin import AdminUserCreate, AdminUserUpdate, AdminRoleUpdate, AdminPasswordReset, AdminUserResponse
from app.utils.auth import get_admin_user, get_superadmin_user, hash_password
from datetime import datetime


class BatchIdsRequest(BaseModel):
    user_ids: list[int]

router = APIRouter(prefix="/api/admin", tags=["用户管理"])


@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    role: str = Query(""),
    is_active: bool | None = Query(None),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if search:
        q = q.filter(User.username.contains(search) | User.nickname.contains(search))
    if role:
        q = q.filter(User.role == role)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    total = q.count()
    users = q.order_by(User.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "users": [{
            "id": u.id, "username": u.username, "nickname": u.nickname,
            "avatar": u.avatar, "role": u.role, "is_active": u.is_active,
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        } for u in users],
    }


@router.get("/users/{user_id}")
def get_user(user_id: int, admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    # 单次聚合查询替代原来的 3 次串行查询(N+1 → 1)
    row = (
        db.query(
            User,
            func.count(PlayLog.id).label('play_count'),
            func.count(Playlist.id).label('playlist_count'),
        )
        .outerjoin(PlayLog, PlayLog.user_id == User.id)
        .outerjoin(Playlist, Playlist.user_id == User.id)
        .filter(User.id == user_id)
        .group_by(User.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    user, play_count, playlist_count = row
    return {
        "id": user.id, "username": user.username, "nickname": user.nickname,
        "avatar": user.avatar, "role": user.role, "is_active": user.is_active,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "play_count": play_count,
        "playlist_count": playlist_count,
    }


@router.post("/users")
def create_user(
    req: AdminUserCreate,
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        nickname=req.nickname or req.username,
        role=req.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username}


@router.put("/users/{user_id}")
def update_user(
    user_id: int, req: AdminUserUpdate,
    admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if req.nickname is not None:
        user.nickname = req.nickname
    if req.avatar is not None:
        user.avatar = req.avatar
    if req.role is not None:
        user.role = req.role
    db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin_id: int = Depends(get_superadmin_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.id == admin_id:
        raise HTTPException(status_code=400, detail="不能删除自己")
    db.delete(user)
    db.commit()
    return {"ok": True}


@router.put("/users/{user_id}/ban")
def ban_user(user_id: int, admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.role in ("admin", "superadmin"):
        raise HTTPException(status_code=400, detail="不能封禁管理员")
    user.is_active = False
    db.commit()
    return {"ok": True}


@router.put("/users/{user_id}/activate")
def activate_user(user_id: int, admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.is_active = True
    db.commit()
    return {"ok": True}


@router.put("/users/{user_id}/role")
def change_role(
    user_id: int, req: AdminRoleUpdate,
    admin_id: int = Depends(get_superadmin_user), db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if req.role not in ("user", "admin", "superadmin"):
        raise HTTPException(status_code=400, detail="无效的角色")
    user.role = req.role
    db.commit()
    return {"ok": True}


@router.put("/users/{user_id}/reset-password")
def reset_password(
    user_id: int, req: AdminPasswordReset,
    admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.password_hash = hash_password(req.new_password)
    db.commit()
    return {"ok": True}


@router.put("/users/batch/ban")
def batch_ban(req: BatchIdsRequest, admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    if not req.user_ids:
        raise HTTPException(status_code=400, detail="user_ids 不能为空")
    count = db.query(User).filter(
        User.id.in_(req.user_ids),
        User.role == "user",
        User.id != admin_id,
    ).update({User.is_active: False}, synchronize_session="fetch")
    db.commit()
    return {"ok": True, "affected": count}


@router.put("/users/batch/activate")
def batch_activate(req: BatchIdsRequest, admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    if not req.user_ids:
        raise HTTPException(status_code=400, detail="user_ids 不能为空")
    count = db.query(User).filter(
        User.id.in_(req.user_ids),
        User.id != admin_id,
    ).update({User.is_active: True}, synchronize_session="fetch")
    db.commit()
    return {"ok": True, "affected": count}


@router.delete("/users/batch/delete")
def batch_delete(req: BatchIdsRequest, admin_id: int = Depends(get_superadmin_user), db: Session = Depends(get_db)):
    if not req.user_ids:
        raise HTTPException(status_code=400, detail="user_ids 不能为空")
    users = db.query(User).filter(
        User.id.in_(req.user_ids),
        User.id != admin_id,
        User.role == "user",
    ).all()
    for u in users:
        db.delete(u)
    db.commit()
    return {"ok": True, "affected": len(users)}
