import os
import subprocess
import gzip
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import text, func
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.play_log import PlayLog
from app.models.playlist import Playlist
from app.models.announcement import Announcement
from app.models.api_metric import ApiMetric
from app.utils.auth import get_admin_user

router = APIRouter(prefix="/api/admin", tags=["数据库管理"])

BACKUP_DIR = "/app/backups"


@router.get("/database/stats")
def database_stats(admin_id: int = Depends(get_admin_user)):
    db = SessionLocal()
    try:
        tables = {
            "users": db.query(func.count(User.id)).scalar(),
            "play_logs": db.query(func.count(PlayLog.id)).scalar(),
            "playlists": db.query(func.count(Playlist.id)).scalar(),
            "announcements": db.query(func.count(Announcement.id)).scalar(),
            "api_metrics": db.query(func.count(ApiMetric.id)).scalar(),
        }
        db_size = db.execute(text(
            "SELECT SUM(data_length + index_length) FROM information_schema.tables "
            "WHERE table_schema = DATABASE()"
        )).scalar()
        return {
            "tables": tables,
            "database_size_bytes": db_size or 0,
            "database_size_mb": round((db_size or 0) / 1024 / 1024, 2),
        }
    finally:
        db.close()


@router.post("/database/backup")
def database_backup(admin_id: int = Depends(get_admin_user)):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    from app.config import get_settings
    s = get_settings()
    filename = f"happymusic_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql.gz"
    filepath = os.path.join(BACKUP_DIR, filename)
    try:
        # 参数列表而非 shell 字符串拼接,避免密码含特殊字符导致的命令注入
        cmd = [
            "mysqldump",
            f"-h{s.MYSQL_HOST}",
            f"-P{str(s.MYSQL_PORT)}",
            f"-u{s.MYSQL_USER}",
            f"-p{s.MYSQL_PASSWORD}",
            s.MYSQL_DATABASE,
        ]
        # mysqldump 输出到 stdout,Python 用 gzip 压缩后落盘
        with gzip.open(filepath, 'wb') as gz:
            result = subprocess.run(
                cmd, stdout=gz, stderr=subprocess.PIPE, timeout=300,
            )
        if result.returncode != 0:
            return {"ok": False, "error": result.stderr.decode('utf-8', errors='ignore')[-500:]}
        return {"ok": True, "filename": filename, "size": os.path.getsize(filepath)}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "备份超时(>300s)"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/database/backups")
def list_backups(admin_id: int = Depends(get_admin_user)):
    if not os.path.exists(BACKUP_DIR):
        return {"files": []}
    files = []
    for f in os.listdir(BACKUP_DIR):
        path = os.path.join(BACKUP_DIR, f)
        if os.path.isfile(path):
            files.append({
                "name": f,
                "size": os.path.getsize(path),
                "modified": datetime.fromtimestamp(os.path.getmtime(path)).isoformat(),
            })
    return {"files": sorted(files, key=lambda x: -x["modified"])}


@router.get("/database/download/{filename}")
def download_backup(filename: str, admin_id: int = Depends(get_admin_user)):
    path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(path, filename=filename)


@router.post("/database/optimize")
def database_optimize(admin_id: int = Depends(get_admin_user)):
    db = SessionLocal()
    try:
        tables = ["users", "play_logs", "playlists", "announcements", "api_metrics"]
        results = {}
        for t in tables:
            db.execute(text(f"ANALYZE TABLE {t}"))
            results[t] = "analyzed"
        db.commit()
        return {"ok": True, "results": results}
    finally:
        db.close()


@router.get("/database/slow-queries")
def slow_queries(admin_id: int = Depends(get_admin_user)):
    db = SessionLocal()
    try:
        rows = db.execute(text(
            "SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 20"
        )).fetchall()
        return {"queries": [dict(r._mapping) for r in rows]}
    except Exception:
        return {"queries": []}
    finally:
        db.close()
