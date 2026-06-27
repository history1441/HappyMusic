"""简单按 IP 限流中间件:保护对音源敏感的接口(/api/search*、/api/refresh-url),
防止单客户端刷请求拖垮 musicdl 上游音源。内存计数,窗口滑动。
"""
import time
from collections import defaultdict
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# 受限路径前缀 + 每窗口最大请求数
RATE_PATHS = ("/api/search", "/api/refresh-url")
RATE_LIMIT = 80  # 每分钟
RATE_WINDOW = 60  # 秒


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._buckets: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method != "OPTIONS" and path.startswith(RATE_PATHS):
            ip = request.client.host if request.client else "unknown"
            now = time.time()
            # 滑动窗口:清理过期命中
            bucket = [t for t in self._buckets[ip] if now - t < RATE_WINDOW]
            if len(bucket) >= RATE_LIMIT:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "请求过于频繁,请稍后再试"},
                    headers={"Retry-After": str(RATE_WINDOW)},
                )
            bucket.append(now)
            self._buckets[ip] = bucket
        return await call_next(request)
