import random
import string
from musicdl.musicdl import MusicClient
from app.config import get_settings

_music_client = None
_music_client_sources: set[str] | None = None

# 短名称 → musicdl 实际客户端名称的映射
SOURCE_NAME_MAP = {
    "netease": "NeteaseMusicClient",
    "qqmusic": "QQMusicClient",
    "kugou": "KugouMusicClient",
    "kuwo": "KuwoMusicClient",
    "migu": "MiguMusicClient",
    "qianqian": "QianqianMusicClient",
    "bilibili": "BilibiliMusicClient",
    "applemusic": "AppleMusicClient",
}

# musicdl 客户端名称 → 中文显示名
SOURCE_DISPLAY_MAP = {
    "NeteaseMusicClient": "网易云音乐",
    "QQMusicClient": "QQ音乐",
    "KugouMusicClient": "酷狗音乐",
    "KuwoMusicClient": "酷我音乐",
    "MiguMusicClient": "咪咕音乐",
    "QianqianMusicClient": "千千音乐",
    "BilibiliMusicClient": "哔哩哔哩",
    "AppleMusicClient": "Apple Music",
}

SEARCH_SIZE = 20


def get_music_client() -> MusicClient:
    global _music_client, _music_client_sources
    settings = get_settings()
    current_sources = set(settings.MUSICDL_SOURCES)
    # 如果源配置变了，重建 client
    if _music_client is None or _music_client_sources != current_sources:
        actual_sources = [SOURCE_NAME_MAP[s] for s in settings.MUSICDL_SOURCES if s in SOURCE_NAME_MAP]
        init_cfg = {s: {"search_size_per_source": SEARCH_SIZE} for s in actual_sources}
        _music_client = MusicClient(
            music_sources=actual_sources,
            init_music_clients_cfg=init_cfg,
        )
        _music_client_sources = current_sources
    return _music_client


def reset_music_client():
    global _music_client, _music_client_sources
    _music_client = None
    _music_client_sources = None


def get_all_sources() -> list[dict]:
    """返回所有可用音乐源及其启用状态"""
    settings = get_settings()
    enabled = set(settings.MUSICDL_SOURCES)
    return [
        {
            "id": short_name,
            "name": display_name,
            "client": client_name,
            "enabled": short_name in enabled,
        }
        for short_name, client_name in SOURCE_NAME_MAP.items()
        for display_name in [SOURCE_DISPLAY_MAP.get(client_name, short_name)]
    ]


def generate_share_code(length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


SOURCE_MAP = {
    "netease": "网易云音乐",
    "qqmusic": "QQ音乐",
    "kugou": "酷狗音乐",
    "kuwo": "酷我音乐",
    "migu": "咪咕音乐",
    "qianqian": "千千音乐",
    "bilibili": "哔哩哔哩",
}
