import platform
from fastapi import APIRouter, Depends
from app.utils.auth import get_admin_user

router = APIRouter(prefix="/api/admin", tags=["系统监控"])


@router.get("/system/resources")
def system_resources(admin_id: int = Depends(get_admin_user)):
    try:
        import psutil
        cpu_percent = psutil.cpu_percent(interval=1)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        return {
            "cpu_percent": cpu_percent,
            "cpu_count": psutil.cpu_count(),
            "memory": {"total": mem.total, "used": mem.used, "percent": mem.percent},
            "disk": {"total": disk.total, "used": disk.used, "percent": disk.percent},
            "platform": platform.platform(),
            "python_version": platform.python_version(),
        }
    except ImportError:
        return {"error": "psutil not installed"}
