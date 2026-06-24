import os
import subprocess
import gzip
import tempfile
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import text, func
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.play_log import PlayLog
from app.models.playlist import Playlist
from app.models.announcement import Announcement
from app.models.api_metric import ApiMetric
from app.utils.auth import get_admin_user
from app.config import get_settings
from app.utils import object_storage

settings = get_settings()

router = APIRouter(prefix="/api/admin", tags=["数据库管理"])

BACKUP_BUCKET = settings.MINIO_BUCKET_BACKUPS


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
    s = get_settings()
    filename = f"happymusic_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql.gz"

    fd, tmp_path = tempfile.mkstemp(suffix='.sql.gz')
    try:
        os.close(fd)
        # 参数列表(非 shell)避免密码含特殊字符导致命令注入
        cmd = [
            "mysqldump",
            f"-h{s.MYSQL_HOST}",
            f"-P{str(s.MYSQL_PORT)}",
            f"-u{s.MYSQL_USER}",
            f"-p{s.MYSQL_PASSWORD}",
            s.MYSQL_DATABASE,
        ]
        with gzip.open(tmp_path, 'wb') as gz:
            result = subprocess.run(
                cmd, stdout=gz, stderr=subprocess.PIPE, timeout=300,
            )
        if result.returncode != 0:
            return {"ok": False, "error": result.stderr.decode('utf-8', errors='ignore')[-500:]}

        file_size = os.path.getsize(tmp_path)
        # 上传到 MinIO 共享存储,避免多实例 404
        object_storage.ensure_bucket(BACKUP_BUCKET)
        client = object_storage.get_minio()
        client.fput_object(BACKUP_BUCKET, filename, tmp_path, content_type="application/gzip")
        return {"ok": True, "filename": filename, "size": file_size}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "备份超时(>300s)"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/database/backups")
def list_backups(admin_id: int = Depends(get_admin_user)):
    files = []
    for obj in object_storage.list_objects(BACKUP_BUCKET):
        files.append({
            "name": obj.object_name,
            "size": obj.size,
            "modified": obj.last_modified.isoformat() if obj.last_modified else None,
        })
    return {"files": sorted(files, key=lambda x: x["modified"] or "", reverse=True)}


@router.get("/database/download/{filename}")
def download_backup(filename: str, admin_id: int = Depends(get_admin_user)):
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="非法文件名")
    if not object_storage.object_exists(BACKUP_BUCKET, filename):
        raise HTTPException(status_code=404, detail="文件不存在")

    response = object_storage.download_object(BACKUP_BUCKET, filename)
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Length": str(response.headers.get("Content-Length", 0)),
    }

    def iter_data():
        try:
            for chunk in response.stream(64 * 1024):
                yield chunk
        finally:
            response.close()
            response.release_conn()

    return StreamingResponse(
        iter_data(), media_type="application/gzip", headers=headers,
    )


@router.delete("/database/backups/{filename}")
def delete_backup(filename: str, admin_id: int = Depends(get_admin_user)):
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="非法文件名")
    if object_storage.object_exists(BACKUP_BUCKET, filename):
        object_storage.delete_object(BACKUP_BUCKET, filename)
    return {"ok": True}


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
