from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    APP_NAME: str = "HappyMusic"
    VERSION: str = "4.1.0"
    DEBUG: bool = os.getenv("HAPPYMUSIC_DEBUG", "false").lower() == "true"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 9527
    # 负载均衡实例标识（多实例部署时区分不同 backend 容器）
    INSTANCE_ID: str = os.getenv("INSTANCE_ID", "backend-1")
    # WebSocket 跨实例广播频道
    WS_BROADCAST_CHANNEL: str = os.getenv("WS_BROADCAST_CHANNEL", "happymusic:ws:broadcast")

    # MySQL
    MYSQL_HOST: str = "happymusic-mysql"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "happymusic"
    MYSQL_PASSWORD: str = ""  # Must be set via .env in production
    MYSQL_DATABASE: str = "happymusic"

    # Redis
    REDIS_HOST: str = "happymusic-redis"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB: int = 0

    # JWT — access 短期(减少泄露风险),refresh 中期(平衡体验)
    JWT_SECRET_KEY: str = ""  # Must be set via .env in production
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 120        # 2 小时(原 7 天)
    JWT_REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 14  # 14 天(原 30 天)

    # MusicDL
    MUSICDL_MAX_THREADS: int = 8
    MUSICDL_SEARCH_SIZE: int = 20
    MUSICDL_SOURCES: list[str] = [
        "netease", "qqmusic", "kugou", "kuwo", "migu", "qianqian",
    ]

    # Share
    SHARE_CODE_LENGTH: int = 6
    SHARE_EXPIRE_DAYS: int = 30

    # Cache TTL (seconds)
    CACHE_TTL_SEARCH: int = 1800       # 搜索结果缓存 30min
    CACHE_TTL_SUGGEST: int = 86400     # 搜索建议缓存 24h
    CACHE_TTL_URL: int = 86400         # 下载URL缓存 24h
    CACHE_TTL_HOT: int = 86400         # 热搜/电台缓存 24h

    # AI
    AI_PROVIDER: str = "openai"  # openai | anthropic
    AI_BASE_URL: str = ""
    AI_API_KEY: str = ""
    AI_MODEL: str = "gpt-3.5-turbo"

    # 默认管理员（仅用于开发环境，生产环境必须通过 .env 配置）
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = ""  # Must be set via .env in production
    ADMIN_ROUTE_PATH: str = "/admin"

    # 审计日志
    AUDIT_LOG_RETENTION_DAYS: int = 90        # 日志保留天数
    AUDIT_LOG_MAX_RECORDS: int = 1000000       # 最大记录数
    AUDIT_LOG_ENABLED: bool = True             # 是否启用审计
    SYSLOG_ENABLED: bool = False               # SYSLOG外发
    SYSLOG_HOST: str = ""
    SYSLOG_PORT: int = 514
    SYSLOG_PROTOCOL: str = "udp"               # udp | tcp

    # CORS 允许的前端源(逗号分隔),生产环境必须配置实际域名
    # 示例: "https://music.dyun.org,https://admin.music.dyun.org"
    # 留空时:DEBUG=true 允许 localhost,DEBUG=false 拒绝所有跨域(仅同源可访问)
    ALLOWED_ORIGINS: str = ""

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
            f"?charset=utf8mb4"
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
