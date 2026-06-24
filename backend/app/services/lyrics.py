"""
歌词获取服务 - 支持网易云、QQ音乐、酷狗三大平台
直接调用各平台API获取精准时间轴LRC歌词，支持翻译合并
"""
import httpx
import re
import base64
import hashlib
import time
import json
from functools import lru_cache
from datetime import datetime, timedelta

# 内存缓存: key -> (lrc, expire_time)
_lyrics_cache: dict[str, tuple[str, datetime]] = {}


def _get_cache(key: str) -> str | None:
    if key in _lyrics_cache:
        lrc, expire = _lyrics_cache[key]
        if datetime.now() < expire:
            return lrc
        del _lyrics_cache[key]
    return None


def _set_cache(key: str, lrc: str, hours: int = 24):
    _lyrics_cache[key] = (lrc, datetime.now() + timedelta(hours=hours))


def _parse_lrc_timestamp(line: str) -> float | None:
    """从LRC行解析第一个时间戳（秒）"""
    m = re.match(r'\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]', line)
    if not m:
        return None
    minutes = int(m.group(1))
    seconds = int(m.group(2))
    ms = m.group(3)
    ms_val = int(ms.ljust(3, '0')) if ms else 0
    return minutes * 60 + seconds + ms_val / 1000


def _merge_translation(original: str, translation: str) -> str:
    """合并原文和翻译LRC，翻译行插入原文行之后"""
    if not translation:
        return original

    # 解析翻译行
    trans_map: dict[float, str] = {}
    for line in translation.strip().split('\n'):
        ts = _parse_lrc_timestamp(line)
        if ts is not None:
            text = re.sub(r'\[.*?\]', '', line).strip()
            if text:
                trans_map[ts] = text

    if not trans_map:
        return original

    result_lines = []
    for line in original.strip().split('\n'):
        result_lines.append(line)
        ts = _parse_lrc_timestamp(line)
        if ts is not None:
            # 找最近的翻译（容差0.5秒）
            for t_ts, t_text in trans_map.items():
                if abs(t_ts - ts) < 0.5:
                    # 插入翻译行，用相同时间戳
                    mm = int(ts // 60)
                    ss = int(ts % 60)
                    ms = int((ts % 1) * 1000)
                    result_lines.append(f"[{mm:02d}:{ss:02d}.{ms:03d}]{t_text}")
                    break

    return '\n'.join(result_lines)


async def _fetch_netease(song_name: str, singers: str) -> str:
    """从网易云音乐获取歌词，支持翻译"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # 搜索歌曲获取ID
            resp = await client.get(
                "https://music.163.com/api/search/get/web",
                params={"s": f"{song_name} {singers}", "type": "1", "offset": "0", "limit": "5"},
                headers={"User-Agent": "Mozilla/5.0", "Referer": "https://music.163.com"},
            )
            data = resp.json()
            songs = data.get("result", {}).get("songs", [])
            if not songs:
                return ""
            song_id = songs[0]["id"]

            # 获取歌词
            resp = await client.get(
                f"https://music.163.com/api/song/lyric",
                params={"id": song_id, "lv": "1", "tv": "1"},
                headers={"User-Agent": "Mozilla/5.0", "Referer": "https://music.163.com"},
            )
            data = resp.json()
            lrc = data.get("lrc", {}).get("lyric", "")
            t_lrc = data.get("tlyric", {}).get("lyric", "")
            return _merge_translation(lrc, t_lrc)
    except Exception:
        return ""


async def _fetch_qqmusic(song_name: str, singers: str) -> str:
    """从QQ音乐获取歌词"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # 搜索歌曲
            resp = await client.get(
                "https://c.y.qq.com/soso/fcgi-bin/client_search_cp",
                params={"w": f"{song_name} {singers}", "format": "json", "n": "5"},
                headers={"User-Agent": "Mozilla/5.0", "Referer": "https://y.qq.com"},
            )
            data = resp.json()
            songs = data.get("data", {}).get("song", {}).get("list", [])
            if not songs:
                return ""
            song_mid = songs[0].get("songmid", "")
            if not song_mid:
                return ""

            # 获取歌词
            resp = await client.get(
                f"https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_yqq.fcg",
                params={"songmid": song_mid, "format": "json", "nobase64": "0"},
                headers={"User-Agent": "Mozilla/5.0", "Referer": "https://y.qq.com"},
            )
            data = resp.json()
            lrc_b64 = data.get("lyric", "")
            if not lrc_b64:
                return ""
            lrc = base64.b64decode(lrc_b64).decode("utf-8", errors="ignore")
            # QQ音乐翻译
            t_lrc_b64 = data.get("trans", "")
            t_lrc = ""
            if t_lrc_b64:
                t_lrc = base64.b64decode(t_lrc_b64).decode("utf-8", errors="ignore")
            return _merge_translation(lrc, t_lrc)
    except Exception:
        return ""


async def _fetch_kugou(song_name: str, singers: str) -> str:
    """从酷狗音乐获取歌词"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # 搜索歌曲
            resp = await client.get(
                "https://songsearch.kugou.com/song_search_v2",
                params={"keyword": f"{song_name} {singers}", "page": "1", "pagesize": "5", "platform": "WebFilter"},
                headers={"User-Agent": "Mozilla/5.0"},
            )
            data = resp.json()
            songs = data.get("data", {}).get("lists", [])
            if not songs:
                return ""
            hash_val = songs[0].get("FileHash", "")
            album_id = songs[0].get("AlbumID", "")
            if not hash_val:
                return ""

            # 获取歌词
            resp = await client.get(
                f"https://www.kugou.com/yy/index.php",
                params={"r": "play/getdata", "hash": hash_val, "album_id": album_id},
                headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.kugou.com"},
            )
            data = resp.json()
            lyrics = data.get("data", {}).get("lyrics", "")
            return lyrics
    except Exception:
        return ""


# 平台优先级映射：优先从歌曲来源平台获取
PLATFORM_FETCHERS = {
    "netease": _fetch_netease,
    "qq": _fetch_qqmusic,
    "kugou": _fetch_kugou,
}

# musicdl source name -> 平台key
SOURCE_TO_PLATFORM = {
    "netease": "netease",
    "163": "netease",
    "qq": "qq",
    "tencent": "qq",
    "kugou": "kugou",
    "酷狗": "kugou",
    "酷我": "kugou",
    "kuwo": "kugou",
}


async def fetch_lyrics(song_name: str, singers: str, source: str = "") -> str:
    """
    统一歌词获取入口
    优先从歌曲来源平台获取，失败则依次尝试其他平台
    结果缓存24小时
    """
    cache_key = f"{song_name}_{singers}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    # 构建获取顺序：来源平台优先
    platform_key = SOURCE_TO_PLATFORM.get(source.lower(), "")
    order = list(PLATFORM_FETCHERS.keys())
    if platform_key and platform_key in order:
        order.remove(platform_key)
        order.insert(0, platform_key)

    for platform in order:
        fetcher = PLATFORM_FETCHERS[platform]
        lrc = await fetcher(song_name, singers)
        if lrc and re.search(r'\[\d{1,2}:\d{2}', lrc):
            # 有时间轴的有效LRC
            _set_cache(cache_key, lrc)
            return lrc

    return ""
