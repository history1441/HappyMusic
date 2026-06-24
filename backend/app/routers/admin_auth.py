from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.admin import AdminLoginRequest
from app.schemas.auth import TokenResponse
from app.utils.auth import verify_password, create_access_token, create_refresh_token, get_admin_user, decode_token
from app.utils.request import get_client_ip
from datetime import datetime

router = APIRouter(prefix="/api/admin", tags=["管理员认证"])

LOGIN_RATE_LIMIT = 5     # 每个 IP 每窗口最大尝试次数
LOGIN_RATE_WINDOW = 60   # 窗口大小(秒)


@router.post("/login", response_model=TokenResponse)
def admin_login(req: AdminLoginRequest, request: Request, db: Session = Depends(get_db)):
    # 基于 IP 的登录速率限制,防暴力破解
    client_ip = get_client_ip(request)
    rate_key = f"admin_login_limit:{client_ip}"
    try:
        from app.utils.redis import get_redis
        r = get_redis()
        count = r.incr(rate_key)
        if count == 1:
            r.expire(rate_key, LOGIN_RATE_WINDOW)
        if count > LOGIN_RATE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"登录尝试过于频繁,请 {LOGIN_RATE_WINDOW} 秒后重试",
            )
    except HTTPException:
        raise
    except Exception:
        pass  # Redis 故障时放行,不阻塞正常登录

    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已被禁用")
    user.last_login_at = datetime.now()
    db.commit()
    return TokenResponse(
        access_token=create_access_token(user.id, user.role, username=user.username),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/verify")
def admin_verify(admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == admin_id).first()
    return {"valid": True, "role": user.role, "username": user.username}


@router.get("/profile")
def admin_profile(admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == admin_id).first()
    return {
        "id": user.id,
        "username": user.username,
        "nickname": user.nickname,
        "role": user.role,
        "avatar": user.avatar,
    }
