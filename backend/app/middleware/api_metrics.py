import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.database import SessionLocal
from app.models.api_metric import ApiMetric


class ApiMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        elapsed_ms = (time.time() - start) * 1000

        # Skip health checks and static files
        path = request.url.path
        if path.startswith("/docs") or path.startswith("/openapi") or path == "/api/health":
            return response

        try:
            db = SessionLocal()
            metric = ApiMetric(
                endpoint=path,
                method=request.method,
                status_code=response.status_code,
                response_ms=elapsed_ms,
            )
            db.add(metric)
            db.commit()
            db.close()
        except Exception:
            pass

        return response
