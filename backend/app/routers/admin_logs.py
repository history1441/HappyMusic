import os
import asyncio
from collections import deque
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from app.utils.auth import get_admin_user, decode_token

router = APIRouter(prefix="/api/admin", tags=["日志查看"])

LOG_DIR = "/app/logs"
LOG_FILE = os.path.join(LOG_DIR, "app.log")


@router.get("/logs")
def get_logs(
    lines: int = Query(200, ge=1, le=2000),
    level: str = Query(""),
    admin_id: int = Depends(get_admin_user),
):
    if not os.path.exists(LOG_FILE):
        return {"logs": [], "message": "日志文件不存在"}
    # deque(maxlen=lines) 流式迭代,仅保留最后 N 行,避免 GB 级日志文件 OOM
    with open(LOG_FILE, "r", encoding="utf-8", errors="ignore") as f:
        last_lines = list(deque(f, maxlen=lines))
    if level:
        last_lines = [l for l in last_lines if level.upper() in l.upper()]
    return {"logs": last_lines, "total": len(last_lines)}


@router.websocket("/ws/admin/logs")
async def ws_logs(websocket: WebSocket):
    await websocket.accept()
    try:
        auth = websocket.query_params.get("token")
        if not auth:
            await websocket.close(code=4001)
            return
        decode_token(auth)
    except Exception:
        await websocket.close(code=4001)
        return

    if not os.path.exists(LOG_FILE):
        await websocket.send_json({"error": "日志文件不存在"})
        await websocket.close()
        return

    with open(LOG_FILE, "r", encoding="utf-8", errors="ignore") as f:
        f.seek(0, 2)
        while True:
            line = f.readline()
            if line:
                try:
                    await websocket.send_json({"line": line.strip()})
                except Exception:
                    break
            else:
                await asyncio.sleep(0.5)
