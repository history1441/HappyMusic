from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.database import get_db
from app.models.api_metric import ApiMetric
from app.utils.auth import get_admin_user

router = APIRouter(prefix="/api/admin", tags=["API监控"])


@router.get("/monitor/response-times")
def response_times(
    hours: int = Query(24, ge=1, le=168),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    since = datetime.now() - timedelta(hours=hours)
    rows = db.query(
        ApiMetric.endpoint,
        func.avg(ApiMetric.response_ms).label("avg_ms"),
        func.max(ApiMetric.response_ms).label("max_ms"),
        func.min(ApiMetric.response_ms).label("min_ms"),
        func.count(ApiMetric.id).label("requests"),
    ).filter(ApiMetric.created_at >= since).group_by(ApiMetric.endpoint).all()
    return [{"endpoint": r[0], "avg_ms": round(r[1], 1), "max_ms": round(r[2], 1),
             "min_ms": round(r[3], 1), "requests": r[4]} for r in rows]


@router.get("/monitor/slow-requests")
def slow_requests(
    limit: int = Query(50, ge=1, le=200),
    threshold_ms: float = Query(1000),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    rows = db.query(ApiMetric).filter(
        ApiMetric.response_ms >= threshold_ms,
    ).order_by(ApiMetric.response_ms.desc()).limit(limit).all()
    return [{
        "id": r.id, "endpoint": r.endpoint, "method": r.method,
        "status_code": r.status_code, "response_ms": round(r.response_ms, 1),
        "created_at": r.created_at.isoformat(),
    } for r in rows]


@router.get("/monitor/error-rates")
def error_rates(
    hours: int = Query(24, ge=1, le=168),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    since = datetime.now() - timedelta(hours=hours)
    total = db.query(func.count(ApiMetric.id)).filter(ApiMetric.created_at >= since).scalar()
    errors_4xx = db.query(func.count(ApiMetric.id)).filter(
        ApiMetric.created_at >= since, ApiMetric.status_code >= 400, ApiMetric.status_code < 500,
    ).scalar()
    errors_5xx = db.query(func.count(ApiMetric.id)).filter(
        ApiMetric.created_at >= since, ApiMetric.status_code >= 500,
    ).scalar()
    return {
        "total_requests": total,
        "errors_4xx": errors_4xx,
        "errors_5xx": errors_5xx,
        "error_rate": round((errors_4xx + errors_5xx) / max(total, 1) * 100, 2),
    }


@router.get("/monitor/timeline")
def monitor_timeline(
    hours: int = Query(24, ge=1, le=168),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    since = datetime.now() - timedelta(hours=hours)
    rows = db.query(
        func.date_trunc("hour", ApiMetric.created_at).label("hour"),
        func.avg(ApiMetric.response_ms).label("avg_ms"),
        func.count(ApiMetric.id).label("requests"),
    ).filter(ApiMetric.created_at >= since).group_by(
        func.date_trunc("hour", ApiMetric.created_at),
    ).order_by(func.date_trunc("hour", ApiMetric.created_at)).all()
    return [{"hour": str(r[0]), "avg_ms": round(r[1], 1), "requests": r[2]} for r in rows]
