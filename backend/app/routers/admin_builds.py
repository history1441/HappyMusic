import os
import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.build_record import BuildRecord
from app.utils.auth import get_admin_user

router = APIRouter(prefix="/api/admin", tags=["应用发布"])

BUILD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "builds")

ALLOWED_EXTENSIONS = {".apk", ".exe", ".ipa", ".zip", ".dmg", ".appimage"}


def _ensure_dirs():
    os.makedirs(BUILD_DIR, exist_ok=True)


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
    _ensure_dirs()
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {ext}")

    filename = file.filename or "unknown"
    plat = platform.strip() if platform.strip() else _detect_platform(filename)
    ver = version.strip() or _extract_version(filename)

    dest = os.path.join(BUILD_DIR, filename)
    if os.path.exists(dest):
        base, e = os.path.splitext(filename)
        dest = os.path.join(BUILD_DIR, f"{base}_{ver}{e}")
        filename = os.path.basename(dest)

    # 分块流式写入,避免大文件(100MB+ APK)整体读入内存导致 OOM
    file_size = 0
    with open(dest, "wb") as f:
        while True:
            chunk = await file.read(1024 * 1024)  # 1MB chunks
            if not chunk:
                break
            f.write(chunk)
            file_size += len(chunk)

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
    if rec.filename:
        path = os.path.join(BUILD_DIR, rec.filename)
        if os.path.exists(path):
            os.remove(path)
    db.delete(rec)
    db.commit()
    return {"ok": True}


@router.get("/builds/downloads")
def list_builds(admin_id: int = Depends(get_admin_user)):
    _ensure_dirs()
    files = []
    for f in os.listdir(BUILD_DIR):
        if f.startswith("."):
            continue
        path = os.path.join(BUILD_DIR, f)
        if os.path.isfile(path):
            files.append({"name": f, "size": os.path.getsize(path), "modified": os.path.getmtime(path)})
    return {"files": sorted(files, key=lambda x: -x["modified"])}


@router.get("/builds/download/{filename}")
def download_build(filename: str, admin_id: int = Depends(get_admin_user)):
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="非法文件名")
    path = os.path.join(BUILD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(path, filename=filename)


@router.delete("/builds/download/{filename}")
def delete_build(filename: str, admin_id: int = Depends(get_admin_user)):
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="非法文件名")
    path = os.path.join(BUILD_DIR, filename)
    if os.path.exists(path):
        os.remove(path)
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
    path = os.path.join(BUILD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="文件不存在")
    rec = db.query(BuildRecord).filter(BuildRecord.filename == filename).first()
    if rec:
        rec.downloads = (rec.downloads or 0) + 1
        db.commit()
    return FileResponse(path, filename=filename)


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
    }
