import logging
import os
import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.config import get_settings
from app.database import engine, Base
from app.routers import auth, search, playlist, share, stats, guess_game, sync, cache, ai, lyrics, qrcode_login
from app.routers import discover
from app.routers import admin_auth, admin_users, admin_analytics, admin_system, admin_config
from app.routers import admin_cache, admin_logs, admin_sources, admin_builds, admin_monitor
from app.routers.admin_builds import public_router
from app.routers import admin_announcements, admin_database, admin_audit_log
from app.middleware.api_metrics import ApiMetricsMiddleware
from app.middleware.audit import AuditMiddleware

# Import models so Base.metadata.create_all picks them up
from app.models import play_log, announcement, api_metric, admin_audit, user_audit, build_record, game_score

settings = get_settings()

# GlitchTip 错误追踪初始化(配置了 DSN 才启用,兼容 Sentry SDK)
if settings.GLITCHTIP_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    sentry_sdk.init(
        dsn=settings.GLITCHTIP_DSN,
        environment=settings.GLITCHTIP_ENVIRONMENT,
        traces_sample_rate=0.1,
        integrations=[SqlalchemyIntegration()],
        send_default_pii=False,
    )
    logging.getLogger().info(f"Sentry/GlitchTip initialized (env={settings.GLITCHTIP_ENVIRONMENT})")

# File logging
LOG_DIR = "/app/logs"
os.makedirs(LOG_DIR, exist_ok=True)


class JsonFormatter(logging.Formatter):
    """结构化 JSON 日志(StreamHandler 用,便于 ELK/Loki 等聚合系统解析)"""
    def format(self, record: logging.LogRecord) -> str:
        log = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "instance": settings.INSTANCE_ID,
        }
        if record.exc_info:
            log["exception"] = self.formatException(record.exc_info)
        return json.dumps(log, ensure_ascii=False)


# 文件日志:纯文本(本地调试易读);控制台日志:JSON(容器日志聚合)
_file_handler = logging.FileHandler(os.path.join(LOG_DIR, "app.log"), encoding="utf-8")
_file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))

_stream_handler = logging.StreamHandler()
_stream_handler.setFormatter(JsonFormatter())

logging.basicConfig(
    level=logging.INFO,
    handlers=[_file_handler, _stream_handler],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_admin()
    # 加载自定义音源适配器(热更新,扫描 custom_sources/)
    try:
        from app.services.source_loader import load_all_custom_sources
        result = load_all_custom_sources()
        if result["loaded"]:
            logging.getLogger().info(f"Loaded {len(result['loaded'])} custom sources: {[s['short_name'] for s in result['loaded']]}")
        if result["failed"]:
            logging.getLogger().warning(f"Failed custom sources: {result['failed']}")
    except Exception as e:
        logging.getLogger().warning(f"Custom sources load failed: {e}")
    # 启动 WebSocket 跨实例广播
    from app.utils.redis import WsBroadcast
    from app.routers.sync import manager as sync_manager
    broadcast = WsBroadcast()
    app.state.ws_broadcast = broadcast
    await sync_manager.start_listener()
    logging.getLogger().info(f"Instance {settings.INSTANCE_ID} started with WS broadcast")
    yield
    sync_manager.close()
    broadcast.close()
    logging.getLogger().info(f"Instance {settings.INSTANCE_ID} shut down")


def _ensure_admin():
    """首次启动时根据 .env 创建默认管理员"""
    from app.database import SessionLocal
    from app.models.user import User
    from app.utils.auth import hash_password
    try:
        db = SessionLocal()
        admin_uname = settings.ADMIN_USERNAME
        existing = db.query(User).filter(User.role.in_(("admin", "superadmin"))).first()
        if not existing:
            user = db.query(User).filter(User.username == admin_uname).first()
            if user:
                user.role = "superadmin"
            else:
                user = User(
                    username=admin_uname,
                    password_hash=hash_password(settings.ADMIN_PASSWORD),
                    nickname="管理员",
                    role="superadmin",
                )
                db.add(user)
            db.commit()
            logging.getLogger().info(f"默认管理员已创建: {admin_uname}")
        db.close()
    except Exception as e:
        logging.getLogger().warning(f"创建管理员失败(表可能还未就绪): {e}")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

# CORS 白名单:ALLOWED_ORIGINS 环境变量(逗号分隔)
# 生产环境必须配置实际域名;开发环境默认放行本地开发端口
if settings.ALLOWED_ORIGINS:
    cors_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
elif settings.DEBUG:
    cors_origins = [
        "http://localhost:5173", "http://localhost:5174",  # Vite dev
        "http://localhost:8190", "http://localhost:8080",  # 前端 + Nginx LB
        "http://127.0.0.1:5173", "http://127.0.0.1:8190",
    ]
else:
    # 生产未配置时,仅允许同源(空列表 + allow_credentials=True 会拒绝所有跨域)
    cors_origins = []

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
# GZip 最外层:响应链最后压缩,减少所有 >1KB 的 JSON 响应传输体积
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(ApiMetricsMiddleware)
app.add_middleware(AuditMiddleware)

# User-facing routes
app.include_router(auth.router)
app.include_router(search.router)
app.include_router(playlist.router)
app.include_router(share.router)
app.include_router(stats.router)
app.include_router(guess_game.router)
app.include_router(sync.router)
app.include_router(cache.router)
app.include_router(ai.router)
app.include_router(lyrics.router)
app.include_router(qrcode_login.router)
app.include_router(discover.router)
app.include_router(public_router)

# Admin routes
app.include_router(admin_auth.router)
app.include_router(admin_users.router)
app.include_router(admin_analytics.router)
app.include_router(admin_system.router)
app.include_router(admin_config.router)
app.include_router(admin_cache.router)
app.include_router(admin_logs.router)
app.include_router(admin_sources.router)
app.include_router(admin_builds.router)
app.include_router(admin_monitor.router)
app.include_router(admin_announcements.router)
app.include_router(admin_database.router)
app.include_router(admin_audit_log.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": settings.VERSION, "instance": settings.INSTANCE_ID}
