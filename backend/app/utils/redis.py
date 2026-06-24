import asyncio
import json
import uuid
import redis
from app.config import get_settings

settings = get_settings()

_redis: redis.Redis | None = None
_pubsub_redis: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD or None,
            db=settings.REDIS_DB,
            decode_responses=True,
            socket_connect_timeout=10,
            socket_timeout=10,
            retry_on_timeout=True,
        )
    return _redis


def get_pubsub_redis() -> redis.Redis:
    """获取用于 Pub/Sub 的独立 Redis 连接（长连接，不设置短 timeout）"""
    global _pubsub_redis
    if _pubsub_redis is None:
        _pubsub_redis = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD or None,
            db=settings.REDIS_DB,
            decode_responses=True,
            socket_connect_timeout=10,
            socket_timeout=30,
        )
    return _pubsub_redis


# --- 搜索结果缓存 ---

def _search_cache_key(keyword: str, sources: list[str] | None = None) -> str:
    if sources:
        sorted_src = ','.join(sorted(sources))
        return f"search:{sorted_src}:{keyword}"
    return f"search:default:{keyword}"


def get_cached_search(keyword: str, sources: list[str] | None = None) -> list[dict] | None:
    key = _search_cache_key(keyword, sources)
    data = get_redis().get(key)
    return json.loads(data) if data else None


def set_cached_search(keyword: str, results: list[dict], sources: list[str] | None = None, ttl: int | None = None):
    key = _search_cache_key(keyword, sources)
    get_redis().setex(key, ttl or settings.CACHE_TTL_SEARCH, json.dumps(results, ensure_ascii=False))


# --- 下载URL缓存 ---

def get_cached_url(source: str, song_identifier: str) -> str | None:
    return get_redis().get(f"url:{source}:{song_identifier}")


def set_cached_url(source: str, song_identifier: str, url: str, ttl: int | None = None):
    get_redis().setex(f"url:{source}:{song_identifier}", ttl or settings.CACHE_TTL_URL, url)


# --- 搜索建议缓存 ---

def get_cached_suggestions(keyword: str) -> list[str] | None:
    data = get_redis().get(f"suggest:{keyword}")
    return json.loads(data) if data else None


def set_cached_suggestions(keyword: str, suggestions: list[str], ttl: int | None = None):
    get_redis().setex(f"suggest:{keyword}", ttl or settings.CACHE_TTL_SUGGEST, json.dumps(suggestions, ensure_ascii=False))


# --- WebSocket 跨实例广播 ---

class WsBroadcast:
    """Redis Pub/Sub 桥接：让多个 backend 实例间能跨实例广播 WebSocket 消息"""

    CHANNEL = "happymusic:ws:broadcast"

    def __init__(self, instance_id: str | None = None):
        self.instance_id = instance_id or settings.INSTANCE_ID
        self._pubsub = None
        self._listener_task = None
        self._running = False

    def publish(self, user_id: int, message: dict):
        """发布消息到 Redis，其他实例会收到并转发给本地 WebSocket 客户端"""
        # 添加元数据
        msg = {
            "_from_instance": self.instance_id,
            "user_id": user_id,
            **message,
        }
        try:
            pub = get_redis()
            pub.publish(self.CHANNEL, json.dumps(msg, ensure_ascii=False))
        except Exception as e:
            import logging
            logging.getLogger().warning(f"WS broadcast publish failed: {e}")

    async def listen(self):
        """监听 Redis Pub/Sub 频道，收到消息后不做处理（由 sync.py 的 ConnectionManager 订阅）"""
        # 注意：实际监听由 ConnectionManager 完成，这个方法是备用方案
        # 主方案在 sync.py 中实现
        pass

    def close(self):
        """关闭 Pub/Sub 连接"""
        global _pubsub_redis
        if _pubsub_redis:
            try:
                _pubsub_redis.close()
            except Exception:
                pass
            _pubsub_redis = None
