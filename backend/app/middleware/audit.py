import json
import time
from concurrent.futures import ThreadPoolExecutor
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from app.config import get_settings
from app.utils.request import get_client_ip

SKIP_PATHS = (
    "/docs", "/openapi", "/api/health",
    "/favicon.ico", "/assets/",
)

AUTH_BODY_PATHS = ("/api/auth/login", "/api/auth/register", "/api/admin/login")

# 审计日志写入专用线程池:避免阻塞请求响应
# record_audit 内部使用独立 Session,线程安全
_audit_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="audit-writer")


def _safe_record_audit(**kwargs):
    """线程池入口:吞掉所有异常,防止后台线程崩溃"""
    try:
        from app.utils.audit import record_audit
        record_audit(**kwargs)
    except Exception:
        pass


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        path = request.url.path

        if not path.startswith("/api/") and not path.startswith("/ws/"):
            return await call_next(request)
        for skip in SKIP_PATHS:
            if path.startswith(skip):
                return await call_next(request)
        if "/admin/audit" in path:
            return await call_next(request)

        # For auth endpoints, read body before call_next to extract username
        body_username = ""
        if path in AUTH_BODY_PATHS and request.method == "POST":
            try:
                body = await request.body()
                if body:
                    data = json.loads(body)
                    body_username = data.get("username", "")
            except Exception:
                pass

        start = time.time()
        response = await call_next(request)
        elapsed_ms = (time.time() - start) * 1000

        if not settings.AUDIT_LOG_ENABLED:
            return response

        user_id = None
        username = body_username
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                from app.utils.auth import decode_token
                payload = decode_token(auth_header[7:])
                user_id = payload.get("sub")
                if not username:
                    username = payload.get("username", "")
            except Exception:
                pass

        # Fallback: look up username from database if token doesn't contain it
        if user_id and not username:
            try:
                from app.database import SessionLocal
                from app.models.user import User
                db = SessionLocal()
                user = db.query(User).filter(User.id == int(user_id)).first()
                if user:
                    username = user.username
                db.close()
            except Exception:
                pass

        action = _classify_action(path, request.method)
        success = 200 <= response.status_code < 400
        detail = _build_detail(action, success, response.status_code)

        # For login/register, resolve user_id from username on success
        if not user_id and username and action in ("login", "admin_login", "register") and success:
            try:
                from app.database import SessionLocal
                from app.models.user import User
                db = SessionLocal()
                user = db.query(User).filter(User.username == username).first()
                if user:
                    user_id = user.id
                db.close()
            except Exception:
                pass

        # 异步写入审计日志,不阻塞响应
        _audit_executor.submit(
            _safe_record_audit,
            action=action,
            user_id=int(user_id) if user_id else None,
            username=username,
            request_method=request.method,
            request_path=path,
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            status_code=response.status_code,
            response_ms=elapsed_ms,
            success=success,
            detail=detail,
            target_type=_extract_target_type(path),
            target_id=_extract_target_id(path),
        )

        return response


def _classify_action(path: str, method: str) -> str:
    if "/admin/login" in path:
        return "admin_login"
    if "/auth/login" in path:
        return "login"
    if "/auth/register" in path:
        return "register"
    if "/qrcode/scan" in path:
        return "qrcode_scan"
    if "/qrcode/confirm" in path:
        return "qrcode_login"
    if "/search" in path:
        return "search"
    if "/play" in path or "/stats/record" in path:
        return "play"
    if "/playlist" in path:
        return "playlist"
    if "/share" in path:
        return "share"
    if "/lyrics" in path:
        return "lyrics"
    if "/download" in path:
        return "download"
    if "/admin/" in path:
        return "admin_op"
    if "/guess" in path:
        return "guess_game"
    if "/ai/" in path or "/recommend" in path:
        return "ai_request"
    if "/sync" in path:
        return "sync"
    return "api_request"


def _build_detail(action: str, success: bool, status_code: int) -> str:
    labels = {
        "login": "用户登录",
        "admin_login": "管理员登录",
        "register": "用户注册",
        "qrcode_scan": "扫码",
        "qrcode_login": "二维码登录",
    }
    label = labels.get(action, "")
    if not label:
        return ""
    if success:
        return f"{label}成功"
    if status_code == 401:
        return f"{label}失败-密码错误"
    if status_code == 403:
        return f"{label}失败-权限不足或账号禁用"
    if status_code == 400:
        return f"{label}失败-请求无效"
    return f"{label}失败-{status_code}"


def _extract_target_type(path: str) -> str:
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 2:
        return parts[1]
    return ""


def _extract_target_id(path: str) -> str:
    parts = [p for p in path.split("/") if p]
    for part in reversed(parts):
        if part.isdigit() or (len(part) < 50 and not part.startswith("api")):
            return part
    return ""
