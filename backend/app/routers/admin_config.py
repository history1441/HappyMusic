import os
from fastapi import APIRouter, Depends, HTTPException
from app.utils.auth import get_admin_user
from app.schemas.admin import ConfigUpdate
from app.config import get_settings, Settings

router = APIRouter(prefix="/api/admin", tags=["配置管理"])

SENSITIVE_KEYWORDS = ("PASSWORD", "SECRET", "KEY", "TOKEN")

# 优先找容器内路径，其次本地路径
_candidates = [
    "/app/.env",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
]


def _find_env_path() -> str:
    for p in _candidates:
        if os.path.exists(p):
            return p
    return _candidates[-1]


def _mask_value(key: str, value: str, reveal: bool = False) -> str:
    if reveal:
        return value
    if any(kw in key.upper() for kw in SENSITIVE_KEYWORDS):
        return "****" if value else ""
    return value


def _read_env_file() -> dict[str, str]:
    env = {}
    path = _find_env_path()
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def _write_env_file(env: dict[str, str]):
    path = _find_env_path()
    # 读取原文件保留注释和空行的结构
    original_lines = []
    written_keys = set()
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            original_lines = f.readlines()

    new_lines = []
    for line in original_lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            new_lines.append(line.rstrip("\n"))
        elif "=" in stripped:
            k = stripped.split("=", 1)[0].strip()
            if k in env:
                new_lines.append(f"{k}={env[k]}")
                written_keys.add(k)
            else:
                new_lines.append(line.rstrip("\n"))
        else:
            new_lines.append(line.rstrip("\n"))

    # 追加新增的 key（原文件中不存在的）
    for k, v in env.items():
        if k not in written_keys:
            new_lines.append(f"{k}={v}")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines) + "\n")


@router.get("/config")
def read_config(
    reveal: bool = False,
    admin_id: int = Depends(get_admin_user),
):
    env = _read_env_file()
    if not env:
        # fallback: 从运行时配置读取
        s = get_settings()
        for field in s.model_fields:
            val = getattr(s, field, None)
            env[field] = str(val) if val is not None else ""
    return {k: _mask_value(k, v, reveal) for k, v in env.items()}


@router.put("/config")
def update_config(
    req: ConfigUpdate,
    admin_id: int = Depends(get_admin_user),
):
    ALLOWED_KEYS = {
        "APP_NAME", "VERSION", "DEBUG",
        "MYSQL_HOST", "MYSQL_PORT", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE",
        "REDIS_HOST", "REDIS_PORT", "REDIS_PASSWORD", "REDIS_DB",
        "JWT_SECRET_KEY", "JWT_ALGORITHM", "JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
        "MUSICDL_MAX_THREADS", "MUSICDL_SEARCH_SIZE", "MUSICDL_SOURCES",
        "CACHE_TTL_SEARCH", "CACHE_TTL_SUGGEST", "CACHE_TTL_URL", "CACHE_TTL_HOT",
        "AI_PROVIDER", "AI_BASE_URL", "AI_API_KEY", "AI_MODEL",
        "ADMIN_USERNAME", "ADMIN_PASSWORD",
    }
    env = _read_env_file()
    # Fallback: populate from runtime settings if file is missing keys
    if not env:
        s = get_settings()
        for field in s.model_fields:
            val = getattr(s, field, None)
            if val is not None:
                env[field.upper()] = str(val)
    for k, v in req.values.items():
        if k not in ALLOWED_KEYS:
            raise HTTPException(status_code=400, detail=f"不允许修改配置项: {k}")
        env[k] = v
    _write_env_file(env)
    get_settings.cache_clear()
    return {"ok": True, "updated": list(req.values.keys())}


@router.post("/config/reload")
def reload_config(admin_id: int = Depends(get_admin_user)):
    get_settings.cache_clear()
    return {"ok": True, "message": "配置已重新加载"}


@router.get("/config/current")
def current_config(admin_id: int = Depends(get_admin_user)):
    s = get_settings()
    data = {}
    for field in s.model_fields:
        val = getattr(s, field, None)
        data[field] = _mask_value(field, str(val) if val is not None else "")
    return data
