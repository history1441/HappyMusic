from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.database import get_db
from app.models.user_audit import UserAuditLog
from app.utils.auth import get_admin_user
from app.config import get_settings

router = APIRouter(prefix="/api/admin/audit", tags=["审计日志"])


@router.get("/logs")
def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str = Query("", description="操作类型筛选"),
    user_id: int | None = Query(None),
    username: str = Query(""),
    success: bool | None = Query(None),
    start_date: str = Query(""),
    end_date: str = Query(""),
    search: str = Query(""),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(UserAuditLog)

    if action:
        actions = [a.strip() for a in action.split(",") if a.strip()]
        if len(actions) == 1:
            q = q.filter(UserAuditLog.action == actions[0])
        elif actions:
            q = q.filter(UserAuditLog.action.in_(actions))
    if user_id:
        q = q.filter(UserAuditLog.user_id == user_id)
    if username:
        q = q.filter(UserAuditLog.username.contains(username))
    if success is not None:
        q = q.filter(UserAuditLog.success == success)
    if start_date:
        try:
            sd = datetime.fromisoformat(start_date)
            q = q.filter(UserAuditLog.created_at >= sd)
        except ValueError:
            pass
    if end_date:
        try:
            ed = datetime.fromisoformat(end_date)
            q = q.filter(UserAuditLog.created_at <= ed)
        except ValueError:
            pass
    if search:
        q = q.filter(
            (UserAuditLog.detail.contains(search)) |
            (UserAuditLog.username.contains(search)) |
            (UserAuditLog.request_path.contains(search)) |
            (UserAuditLog.ip_address.contains(search))
        )

    total = q.count()
    logs = q.order_by(UserAuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "logs": [{
            "id": l.id,
            "user_id": l.user_id,
            "username": l.username,
            "action": l.action,
            "target_type": l.target_type,
            "target_id": l.target_id,
            "detail": l.detail,
            "ip_address": l.ip_address,
            "user_agent": l.user_agent,
            "request_method": l.request_method,
            "request_path": l.request_path,
            "status_code": l.status_code,
            "response_ms": round(l.response_ms, 2),
            "success": l.success,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        } for l in logs],
    }


@router.get("/stats")
def audit_stats(
    days: int = Query(30, ge=1, le=365),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    since = datetime.now() - timedelta(days=days)

    # 操作类型分布
    action_dist = db.query(
        UserAuditLog.action, func.count(UserAuditLog.id).label("count"),
    ).filter(UserAuditLog.created_at >= since).group_by(UserAuditLog.action).all()

    # 成功/失败统计
    success_count = db.query(func.count(UserAuditLog.id)).filter(
        UserAuditLog.created_at >= since, UserAuditLog.success == True
    ).scalar()
    fail_count = db.query(func.count(UserAuditLog.id)).filter(
        UserAuditLog.created_at >= since, UserAuditLog.success == False
    ).scalar()

    # 每日操作趋势
    daily = db.query(
        func.date(UserAuditLog.created_at).label("date"),
        func.count(UserAuditLog.id).label("total"),
    ).filter(UserAuditLog.created_at >= since).group_by(
        func.date(UserAuditLog.created_at)
    ).order_by(func.date(UserAuditLog.created_at)).all()

    # 登录趋势
    login_daily = db.query(
        func.date(UserAuditLog.created_at).label("date"),
        func.count(UserAuditLog.id).label("total"),
    ).filter(
        UserAuditLog.created_at >= since,
        UserAuditLog.action.in_(("login", "admin_login")),
    ).group_by(func.date(UserAuditLog.created_at)).order_by(func.date(UserAuditLog.created_at)).all()

    # TOP 活跃用户
    top_users = db.query(
        UserAuditLog.username, func.count(UserAuditLog.id).label("count"),
    ).filter(UserAuditLog.created_at >= since, UserAuditLog.username != "").group_by(
        UserAuditLog.username
    ).order_by(func.count(UserAuditLog.id).desc()).limit(10).all()

    # 登录失败 TOP IP
    fail_ips = db.query(
        UserAuditLog.ip_address, func.count(UserAuditLog.id).label("count"),
    ).filter(
        UserAuditLog.created_at >= since, UserAuditLog.success == False,
        UserAuditLog.action.in_(("login", "admin_login")),
        UserAuditLog.ip_address != "",
    ).group_by(UserAuditLog.ip_address).order_by(func.count(UserAuditLog.id).desc()).limit(10).all()

    # 最近登录记录
    recent_logins = db.query(UserAuditLog).filter(
        UserAuditLog.action.in_(("login", "admin_login")),
    ).order_by(UserAuditLog.created_at.desc()).limit(20).all()

    return {
        "action_distribution": [{"action": r[0], "count": r[1]} for r in action_dist],
        "success_count": success_count,
        "fail_count": fail_count,
        "daily_trend": [{"date": str(r[0]), "total": r[1]} for r in daily],
        "login_trend": [{"date": str(r[0]), "total": r[1]} for r in login_daily],
        "top_users": [{"username": r[0], "count": r[1]} for r in top_users],
        "fail_ips": [{"ip": r[0], "count": r[1]} for r in fail_ips],
        "recent_logins": [{
            "id": l.id, "username": l.username, "action": l.action,
            "ip_address": l.ip_address, "success": l.success,
            "detail": l.detail, "created_at": l.created_at.isoformat() if l.created_at else None,
        } for l in recent_logins],
    }


@router.get("/config")
def get_audit_config(admin_id: int = Depends(get_admin_user)):
    settings = get_settings()
    return {
        "enabled": settings.AUDIT_LOG_ENABLED,
        "retention_days": settings.AUDIT_LOG_RETENTION_DAYS,
        "max_records": settings.AUDIT_LOG_MAX_RECORDS,
        "syslog_enabled": settings.SYSLOG_ENABLED,
        "syslog_host": settings.SYSLOG_HOST,
        "syslog_port": settings.SYSLOG_PORT,
        "syslog_protocol": settings.SYSLOG_PROTOCOL,
    }


@router.get("/login-history")
def login_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    username: str = Query(""),
    success: bool | None = Query(None),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(UserAuditLog).filter(
        UserAuditLog.action.in_(("login", "admin_login"))
    )
    if username:
        q = q.filter(UserAuditLog.username.contains(username))
    if success is not None:
        q = q.filter(UserAuditLog.success == success)

    total = q.count()
    logs = q.order_by(UserAuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "logs": [{
            "id": l.id, "user_id": l.user_id, "username": l.username,
            "action": l.action, "ip_address": l.ip_address,
            "user_agent": l.user_agent, "success": l.success,
            "detail": l.detail,
            "response_ms": round(l.response_ms, 2) if l.response_ms else None,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        } for l in logs],
    }


@router.delete("/cleanup")
def manual_cleanup(
    days: int = Query(90, ge=1),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    cutoff = datetime.now() - timedelta(days=days)
    deleted = db.query(UserAuditLog).filter(UserAuditLog.created_at < cutoff).delete()
    db.commit()
    return {"ok": True, "deleted": deleted, "message": f"已清理 {deleted} 条超过 {days} 天的审计日志"}
