import json
import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.database import get_db
from app.models.play_log import PlayLog
from app.utils.auth import get_admin_user
from app.utils.music import (
    SOURCE_NAME_MAP, SOURCE_DISPLAY_MAP, SEARCH_SIZE,
    get_all_sources, reset_music_client,
)
from app.config import get_settings
from app.routers.admin_config import _read_env_file, _write_env_file

router = APIRouter(prefix="/api/admin", tags=["音乐源管理"])


class ToggleRequest(BaseModel):
    source_id: str
    enabled: bool


class TestRequest(BaseModel):
    source_id: str
    keyword: str = "周杰伦"


@router.get("/sources/list")
def list_sources(admin_id: int = Depends(get_admin_user)):
    return {"sources": get_all_sources()}


@router.put("/sources/toggle")
def toggle_source(req: ToggleRequest, admin_id: int = Depends(get_admin_user)):
    if req.source_id not in SOURCE_NAME_MAP:
        raise HTTPException(status_code=400, detail=f"未知的音乐源: {req.source_id}")

    settings = get_settings()
    current = list(settings.MUSICDL_SOURCES)

    if req.enabled and req.source_id not in current:
        current.append(req.source_id)
    elif not req.enabled and req.source_id in current:
        current.remove(req.source_id)
    else:
        return {"ok": True, "sources": current, "changed": False}

    # 更新 .env 文件：先读取磁盘，再用运行时配置补全缺失项
    env = _read_env_file()
    s = get_settings()
    for field in s.model_fields:
        key = field.upper()
        if key not in env:
            val = getattr(s, field, None)
            if val is not None:
                env[key] = json.dumps(val, ensure_ascii=False) if isinstance(val, (list, dict)) else str(val)
    env["MUSICDL_SOURCES"] = json.dumps(current, ensure_ascii=False)
    _write_env_file(env)

    # 刷新运行时配置和单例
    get_settings.cache_clear()
    reset_music_client()

    return {"ok": True, "sources": current, "changed": True}


@router.post("/sources/test")
def test_source(req: TestRequest, admin_id: int = Depends(get_admin_user)):
    if req.source_id not in SOURCE_NAME_MAP:
        raise HTTPException(status_code=400, detail=f"未知的音乐源: {req.source_id}")

    from concurrent.futures import ThreadPoolExecutor
    from app.routers.search import _search_single_source

    client_name = SOURCE_NAME_MAP[req.source_id]
    display_name = SOURCE_DISPLAY_MAP.get(client_name, req.source_id)

    t0 = time.time()
    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(_search_single_source, req.keyword, client_name)
            songs = future.result(timeout=60)
    except Exception as e:
        return {
            "source_id": req.source_id,
            "source_name": display_name,
            "success": False,
            "error": str(e),
            "elapsed": round(time.time() - t0, 1),
        }

    return {
        "source_id": req.source_id,
        "source_name": display_name,
        "success": True,
        "count": len(songs),
        "elapsed": round(time.time() - t0, 1),
        "sample": songs[:3] if songs else [],
    }


@router.get("/sources/stats")
def sources_stats(admin_id: int = Depends(get_admin_user), db: Session = Depends(get_db)):
    since = datetime.now() - timedelta(days=7)
    rows = db.query(
        PlayLog.source, func.count(PlayLog.id).label("plays"),
    ).filter(PlayLog.played_at >= since).group_by(PlayLog.source).all()
    return {r[0] or "unknown": r[1] for r in rows}


# ========== musicdl 第三方库热更新 ==========

@router.get("/sources/musicdl/version")
def musicdl_version(admin_id: int = Depends(get_admin_user)):
    """查看当前 musicdl 版本和 PyPI 最新版本"""
    from app.services.musicdl_updater import get_musicdl_version, get_latest_version
    return {
        "current": get_musicdl_version(),
        "latest": get_latest_version(),
    }


@router.post("/sources/musicdl/upgrade")
def musicdl_upgrade(body: dict = None, admin_id: int = Depends(get_admin_user)):
    """运行中升级 musicdl(无需重启 backend,清除模块缓存后下次搜索生效)

    Body(可选): {"version": "2.11.0"} 指定版本;不传则升级到最新
    """
    from app.services.musicdl_updater import upgrade_musicdl
    version = (body or {}).get("version")
    return upgrade_musicdl(version)


# ========== 自定义音源适配器热加载 ==========

@router.get("/sources/custom/list")
def custom_sources_list(admin_id: int = Depends(get_admin_user)):
    """列出已加载的自定义音源适配器"""
    from app.services.source_loader import get_loaded_sources
    return {"sources": get_loaded_sources()}


@router.post("/sources/custom/reload")
def custom_sources_reload(admin_id: int = Depends(get_admin_user)):
    """重新扫描 custom_sources/ 目录,热加载适配器"""
    from app.services.source_loader import reload_all
    return reload_all()

