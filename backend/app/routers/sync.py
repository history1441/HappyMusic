import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import jwt, JWTError
from app.config import get_settings
from app.utils.redis import get_pubsub_redis, WsBroadcast

settings = get_settings()
router = APIRouter(tags=["多端同步"])


class ConnectionManager:
    def __init__(self):
        self.active: dict[int, list[WebSocket]] = {}
        self._pubsub = None
        self._listener_task = None
        self._broadcast = WsBroadcast()

    async def connect(self, ws: WebSocket, user_id: int):
        await ws.accept()
        if user_id not in self.active:
            self.active[user_id] = []
        self.active[user_id].append(ws)

    def disconnect(self, ws: WebSocket, user_id: int):
        if user_id in self.active:
            self.active[user_id] = [w for w in self.active[user_id] if w != ws]
            if not self.active[user_id]:
                del self.active[user_id]

    async def broadcast(self, user_id: int, message: dict, exclude: WebSocket | None = None):
        # 1. 发送给本地该用户的所有 WebSocket 连接
        for ws in self.active.get(user_id, []):
            if ws != exclude:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

        # 2. 发布到 Redis，让其他实例也收到（排除自身实例的消息）
        self._broadcast.publish(user_id, message)

    async def send_to_user(self, user_id: int, message: dict):
        """向指定用户的所有连接发送消息"""
        for ws in self.active.get(user_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def start_listener(self):
        """启动 Redis Pub/Sub 监听协程"""
        self._pubsub = get_pubsub_redis().pubsub()
        await self._pubsub.subscribe(settings.WS_BROADCAST_CHANNEL)
        self._listener_task = asyncio.create_task(self._listen_loop())

    async def _listen_loop(self):
        """监听 Redis 频道，将其他实例的消息转发给本地 WebSocket 客户端"""
        try:
            while True:
                message = await self._pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message['type'] == 'message':
                    try:
                        data = json.loads(message['data'])
                        # 忽略来自自身实例的消息
                        if data.get('_from_instance') == settings.INSTANCE_ID:
                            continue
                        user_id = data.get('user_id')
                        if user_id and user_id in self.active:
                            payload = {k: v for k, v in data.items() if k != 'user_id'}
                            for ws in self.active[user_id]:
                                try:
                                    await ws.send_json(payload)
                                except Exception:
                                    pass
                    except (json.JSONDecodeError, KeyError):
                        pass
        except asyncio.CancelledError:
            pass
        finally:
            await self._pubsub.unsubscribe(settings.WS_BROADCAST_CHANNEL)
            self._pubsub.close()

    def close(self):
        """关闭监听器"""
        if self._listener_task:
            self._listener_task.cancel()
        if self._pubsub:
            self._pubsub.close()
        self._broadcast.close()


manager = ConnectionManager()


@router.websocket("/ws/sync")
async def sync_ws(ws: WebSocket, token: str = ""):
    # Authenticate
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]) if token else None
    except JWTError:
        payload = None
    if not payload:
        await ws.close(code=4001)
        return

    user_id = payload.get("sub")
    if not user_id:
        await ws.close(code=4001)
        return

    user_id = int(user_id)
    await manager.connect(ws, user_id)

    # 发送当前实例的欢迎消息（让客户端知道已连接）
    try:
        await ws.send_json({
            "type": "connected",
            "instance": settings.INSTANCE_ID,
        })
    except Exception:
        pass

    try:
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")

            if msg_type == "player_state":
                await manager.broadcast(user_id, {
                    "type": "player_state",
                    "song": msg.get("song"),
                    "is_playing": msg.get("is_playing"),
                    "progress": msg.get("progress"),
                    "volume": msg.get("volume"),
                    "play_mode": msg.get("play_mode"),
                    "timestamp": msg.get("timestamp"),
                }, exclude=ws)

            elif msg_type == "command":
                await manager.broadcast(user_id, {
                    "type": "command",
                    "action": msg.get("action"),
                    "params": msg.get("params"),
                }, exclude=ws)

            elif msg_type == "request_state":
                await manager.broadcast(user_id, {
                    "type": "request_state",
                }, exclude=ws)

            elif msg_type == "sync_state":
                await manager.send_to_user(user_id, {
                    "type": "full_state",
                    "song": msg.get("song"),
                    "is_playing": msg.get("is_playing"),
                    "progress": msg.get("progress"),
                    "volume": msg.get("volume"),
                    "play_mode": msg.get("play_mode"),
                })

    except WebSocketDisconnect:
        manager.disconnect(ws, user_id)
