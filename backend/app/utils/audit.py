import logging
from app.database import SessionLocal
from app.models.user_audit import UserAuditLog
from app.utils.syslog_sender import send_syslog
from app.config import get_settings

logger = logging.getLogger(__name__)


def record_audit(
    action: str,
    user_id: int | None = None,
    username: str = "",
    target_type: str = "",
    target_id: str = "",
    detail: str = "",
    ip_address: str = "",
    user_agent: str = "",
    request_method: str = "",
    request_path: str = "",
    status_code: int = 0,
    response_ms: float = 0.0,
    success: bool = True,
):
    settings = get_settings()
    if not settings.AUDIT_LOG_ENABLED:
        return

    event = {
        "action": action,
        "user_id": user_id,
        "username": username,
        "target_type": target_type,
        "target_id": target_id,
        "detail": detail,
        "ip_address": ip_address,
        "status_code": status_code,
        "response_ms": response_ms,
        "success": success,
    }

    # SYSLOG 外发
    send_syslog(event)

    try:
        db = SessionLocal()
        log = UserAuditLog(
            user_id=user_id,
            username=username,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            detail=detail,
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent else "",
            request_method=request_method,
            request_path=request_path[:300] if request_path else "",
            status_code=status_code,
            response_ms=response_ms,
            success=success,
        )
        db.add(log)
        db.commit()
        db.close()

        # 检查是否超过最大记录数，异步清理
        _check_and_cleanup()
    except Exception as e:
        logger.warning(f"审计日志写入失败: {e}")


def _check_and_cleanup():
    settings = get_settings()
    max_records = settings.AUDIT_LOG_MAX_RECORDS
    retention_days = settings.AUDIT_LOG_RETENTION_DAYS

    try:
        db = SessionLocal()
        from sqlalchemy import text, func
        from datetime import datetime, timedelta

        # 按保留天数清理
        cutoff = datetime.now() - timedelta(days=retention_days)
        db.query(UserAuditLog).filter(UserAuditLog.created_at < cutoff).delete()

        # 按最大记录数清理（保留最新记录）
        count = db.query(func.count(UserAuditLog.id)).scalar()
        if count > max_records:
            excess = count - max_records
            old_ids = db.query(UserAuditLog.id).order_by(UserAuditLog.id.asc()).limit(excess).all()
            if old_ids:
                db.query(UserAuditLog).filter(UserAuditLog.id.in_([r[0] for r in old_ids])).delete()

        db.commit()
        db.close()
    except Exception as e:
        logger.warning(f"审计日志清理失败: {e}")
