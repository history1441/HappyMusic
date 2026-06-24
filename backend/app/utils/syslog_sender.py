import socket
import json
import logging
from datetime import datetime
from app.config import get_settings

logger = logging.getLogger(__name__)


def send_syslog(event: dict):
    settings = get_settings()
    if not settings.SYSLOG_ENABLED or not settings.SYSLOG_HOST:
        return

    try:
        msg = json.dumps({
            "app": settings.APP_NAME,
            "timestamp": datetime.now().isoformat(),
            **event,
        }, ensure_ascii=False)

        if settings.SYSLOG_PROTOCOL == "tcp":
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(3)
                s.connect((settings.SYSLOG_HOST, settings.SYSLOG_PORT))
                s.sendall((msg + "\n").encode("utf-8"))
        else:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.settimeout(3)
                s.sendto(msg.encode("utf-8"), (settings.SYSLOG_HOST, settings.SYSLOG_PORT))
    except Exception as e:
        logger.warning(f"SYSLOG发送失败: {e}")
