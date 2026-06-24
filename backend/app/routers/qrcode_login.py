import json
import uuid
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.utils.auth import verify_password, create_access_token, create_refresh_token, get_current_user, decode_token
from app.utils.redis import get_redis

router = APIRouter(prefix="/api/qrcode", tags=["二维码登录"])

QRCODE_TTL = 60  # 二维码60秒有效


@router.post("/generate")
def generate_qrcode(request: Request):
    """Web/PC端生成二维码token"""
    code = str(uuid.uuid4())
    r = get_redis()
    state = json.dumps({
        "status": "pending",  # pending | scanned | confirmed
        "code": code,
        "user_id": None,
        "username": None,
        "token": None,
        "created_at": datetime.now().isoformat(),
    })
    r.setex(f"qrcode:{code}", QRCODE_TTL, state)
    return {
        "code": code,
        "expires_in": QRCODE_TTL,
        "url": f"happymusic://qrcode-login/{code}",
    }


@router.post("/scan")
def scan_qrcode(
    code: str,
    user_id: int = Depends(get_current_user),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """移动端扫描二维码"""
    r = get_redis()
    data = r.get(f"qrcode:{code}")
    if not data:
        raise HTTPException(status_code=400, detail="二维码已过期或不存在")

    state = json.loads(data)
    if state["status"] != "pending":
        raise HTTPException(status_code=400, detail="二维码已被扫描")

    user = db.query(User).filter(User.id == user_id).first()
    state["status"] = "scanned"
    state["user_id"] = user_id
    state["username"] = user.username if user else ""
    r.setex(f"qrcode:{code}", QRCODE_TTL, json.dumps(state))
    return {"ok": True, "message": "扫描成功，等待确认", "username": state["username"]}


@router.post("/confirm")
def confirm_qrcode(
    code: str,
    user_id: int = Depends(get_current_user),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """移动端确认登录"""
    r = get_redis()
    data = r.get(f"qrcode:{code}")
    if not data:
        raise HTTPException(status_code=400, detail="二维码已过期")

    state = json.loads(data)
    if state["status"] != "scanned":
        raise HTTPException(status_code=400, detail="二维码状态异常")
    if state["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="用户不匹配")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id)

    state["status"] = "confirmed"
    state["token"] = access_token
    state["refresh_token"] = refresh_token
    r.setex(f"qrcode:{code}", 30, json.dumps(state))  # confirmed后保留30秒供PC端读取
    return {"ok": True, "message": "登录已确认"}


@router.post("/cancel")
def cancel_qrcode(
    code: str,
    user_id: int = Depends(get_current_user),
):
    """移动端取消登录"""
    r = get_redis()
    data = r.get(f"qrcode:{code}")
    if not data:
        raise HTTPException(status_code=400, detail="二维码已过期")
    state = json.loads(data)
    state["status"] = "cancelled"
    r.setex(f"qrcode:{code}", 10, json.dumps(state))
    return {"ok": True, "message": "已取消"}


@router.get("/status")
def qrcode_status(code: str):
    """PC端轮询二维码状态"""
    r = get_redis()
    data = r.get(f"qrcode:{code}")
    if not data:
        return {"status": "expired"}

    state = json.loads(data)
    result = {"status": state["status"]}

    if state["status"] == "scanned":
        result["username"] = state["username"]
    elif state["status"] == "confirmed":
        result["access_token"] = state["token"]
        result["refresh_token"] = state["refresh_token"]
        result["username"] = state["username"]
        # 读取后删除
        r.delete(f"qrcode:{code}")

    return result


@router.websocket("/ws/poll/{code}")
async def qrcode_ws_poll(websocket: WebSocket, code: str):
    """WebSocket方式实时推送二维码状态变化"""
    await websocket.accept()
    r = get_redis()

    try:
        for _ in range(QRCODE_TTL + 10):
            data = r.get(f"qrcode:{code}")
            if not data:
                await websocket.send_json({"status": "expired"})
                break

            state = json.loads(data)
            result = {"status": state["status"]}

            if state["status"] == "scanned":
                result["username"] = state["username"]
            elif state["status"] == "confirmed":
                result["access_token"] = state["token"]
                result["refresh_token"] = state["refresh_token"]
                result["username"] = state["username"]
                r.delete(f"qrcode:{code}")

            await websocket.send_json(result)

            if state["status"] in ("confirmed", "cancelled"):
                break

            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
