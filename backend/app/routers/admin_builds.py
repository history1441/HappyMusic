import os
import re
import tempfile
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.build_record import BuildRecord
from app.utils.auth import get_admin_user
from app.config import get_settings
from app.utils import object_storage

settings = get_settings()

router = APIRouter(prefix="/api/admin", tags=["应用发布"])

BUCKET = settings.MINIO_BUCKET_BUILDS

ALLOWED_EXTENSIONS = {".apk", ".exe", ".ipa", ".zip", ".dmg", ".appimage"}
MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500MB


def _detect_platform(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".apk":
        return "android"
    if ext == ".exe":
        return "windows"
    if ext == ".ipa":
        return "ios"
    if ext in (".dmg", ".appimage"):
        return "desktop"
    return "web"


def _extract_version(filename: str) -> str:
    m = re.search(r'(\d+\.\d+\.\d+)', filename)
    return m.group(1) if m else "1.0.0"


def _guess_content_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return {
        ".apk": "application/vnd.android.package-archive",
        ".exe": "application/x-msdownload",
        ".ipa": "application/octet-stream",
        ".zip": "application/zip",
        ".dmg": "application/x-apple-diskimage",
        ".appimage": "application/x-executable",
    }.get(ext, "application/octet-stream")


def _stream_from_minio(bucket: str, object_name: str, download_name: str):
    """从 MinIO 流式读取,返回 StreamingResponse"""
    response = object_storage.download_object(bucket, object_name)
    headers = {
        "Content-Disposition": f'attachment; filename="{download_name}"',
        "Content-Length": str(response.headers.get("Content-Length", 0)),
    }
    content_type = response.headers.get("Content-Type", "application/octet-stream")

    def iter_data():
        try:
            for chunk in response.stream(64 * 1024):
                yield chunk
        finally:
            response.close()
            response.release_conn()

    return StreamingResponse(iter_data(), media_type=content_type, headers=headers)


# --- Admin endpoints ---

@router.post("/builds/upload")
async def upload_package(
    file: UploadFile = File(...),
    version: str = Form(""),
    platform: str = Form(""),
    changelog: str = Form(""),
    admin_id: int = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {ext}")

    filename = file.filename or "unknown"
    plat = platform.strip() if platform.strip() else _detect_platform(filename)
    ver = version.strip() or _extract_version(filename)

    # 同名时追加版本号
    if object_storage.object_exists(BUCKET, filename):
        base, e = os.path.splitext(filename)
        filename = f"{base}_{ver}{e}"

    content_type = _guess_content_type(filename)

    # 先流式落临时文件(避免大文件 OOM),再 fput_object 上传 MinIO
    file_size = 0
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp_path = tmp.name
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            file_size += len(chunk)
            if file_size > MAX_UPLOAD_SIZE:
                tmp.close()
                os.unlink(tmp_path)
                raise HTTPException(status_code=413, detail=f"文件超过 {MAX_UPLOAD_SIZE // 1024 // 1024}MB 限制")
            tmp.write(chunk)

    try:
        object_storage.ensure_bucket(BUCKET)
        client = object_storage.get_minio()
        client.fput_object(BUCKET, filename, tmp_path, content_type=content_type)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    rec = BuildRecord(
        build_type="upload", version=ver, platform=plat,
        changelog=changelog, is_published=False, status="success",
        filename=filename, file_size=file_size,
        message=f"已上传 {filename}", completed_at=datetime.now(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return {"ok": True, "id": rec.id, "filename": filename, "version": ver, "platform": plat}


@router.get("/builds/releases")
def list_releases(admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    records = db.query(BuildRecord).filter(BuildRecord.build_type == "upload").order_by(BuildRecord.id.desc()).all()
    return {"records": [_serialize(r) for r in records]}


@router.put("/builds/releases/{release_id}/publish")
def toggle_publish(release_id: int, body: dict, admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    rec = db.query(BuildRecord).filter(BuildRecord.id == release_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="记录不存在")
    rec.is_published = body.get("published", not rec.is_published)
    rec.message = "已发布" if rec.is_published else "已取消发布"
    db.commit()
    return {"ok": True, "is_published": rec.is_published}


@router.delete("/builds/releases/{release_id}")
def delete_release(release_id: int, admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    rec = db.query(BuildRecord).filter(BuildRecord.id == release_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="记录不存在")
    # 删除对象存储中的文件
    if rec.filename:
        try:
            object_storage.delete_object(BUCKET, rec.filename)
        except Exception:
            pass  # 对象不存在不阻断删除
    db.delete(rec)
    db.commit()
    return {"ok": True}


@router.get("/builds/downloads")
def list_builds(admin_id: int = Depends(get_admin_user)):
    files = []
    for obj in object_storage.list_objects(BUCKET):
        if obj.object_name.startswith("."):
            continue
        files.append({
            "name": obj.object_name,
            "size": obj.size,
            "modified": obj.last_modified.timestamp() if obj.last_modified else 0,
        })
    return {"files": sorted(files, key=lambda x: -x["modified"])}


@router.get("/builds/download/{filename}")
def download_build(filename: str, admin_id: int = Depends(get_admin_user)):
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="非法文件名")
    if not object_storage.object_exists(BUCKET, filename):
        raise HTTPException(status_code=404, detail="文件不存在")
    return _stream_from_minio(BUCKET, filename, filename)


@router.delete("/builds/download/{filename}")
def delete_build(filename: str, admin_id: int = Depends(get_admin_user)):
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="非法文件名")
    if object_storage.object_exists(BUCKET, filename):
        object_storage.delete_object(BUCKET, filename)
    return {"ok": True}


@router.get("/builds/history")
def build_history(admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    records = db.query(BuildRecord).order_by(BuildRecord.id.desc()).limit(50).all()
    return {"records": [_serialize(r) for r in records]}


# --- Public endpoints (no auth) ---

public_router = APIRouter(prefix="/api/app", tags=["应用更新"])


@public_router.get("/releases/latest")
def get_latest_release(platform: str = "android", db: Session = Depends(get_db)):
    rec = (
        db.query(BuildRecord)
        .filter(BuildRecord.is_published == True, BuildRecord.platform == platform)
        .order_by(BuildRecord.id.desc())
        .first()
    )
    if not rec:
        return {"version": None}
    return _serialize(rec)


@public_router.get("/releases")
def list_public_releases(platform: str = "", db: Session = Depends(get_db)):
    q = db.query(BuildRecord).filter(BuildRecord.is_published == True)
    if platform:
        q = q.filter(BuildRecord.platform == platform)
    records = q.order_by(BuildRecord.id.desc()).limit(20).all()
    return {"records": [_serialize(r) for r in records]}


@public_router.get("/releases/download/{filename}")
def download_release(filename: str, db: Session = Depends(get_db)):
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="非法文件名")
    if not object_storage.object_exists(BUCKET, filename):
        raise HTTPException(status_code=404, detail="文件不存在")
    rec = db.query(BuildRecord).filter(BuildRecord.filename == filename).first()
    if rec:
        rec.downloads = (rec.downloads or 0) + 1
        db.commit()
    return _stream_from_minio(BUCKET, filename, filename)


def _serialize(r: BuildRecord) -> dict:
    return {
        "id": r.id,
        "build_type": r.build_type,
        "version": r.version or "",
        "platform": r.platform or "",
        "changelog": r.changelog or "",
        "is_published": r.is_published,
        "status": r.status,
        "message": r.message or "",
        "filename": r.filename or "",
        "file_size": r.file_size,
        "downloads": r.downloads or 0,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        # 下载地址(应用内更新直接用)
        "download_url": f"/api/app/releases/download/{r.filename}" if r.filename else None,
    }
