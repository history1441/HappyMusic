import asyncio
import json
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.music import SongInfo, SearchRequest, SearchResponse, SourceResponse, RefreshUrlRequest
from app.utils.music import SOURCE_NAME_MAP, SOURCE_DISPLAY_MAP, SEARCH_SIZE
from app.utils.auth import get_current_user
from app.utils.redis import (
    get_cached_search, set_cached_search,
    get_cached_suggestions, set_cached_suggestions,
    get_cached_url, set_cached_url,
)
from app.config import get_settings

router = APIRouter(prefix="/api", tags=["搜索"])
executor = ThreadPoolExecutor(max_workers=6)


def _get_actual_sources(sources: list[str] | None = None) -> list[str]:
    """将短名称列表转为实际 musicdl 客户端名称"""
    if sources:
        return [SOURCE_NAME_MAP[s] for s in sources if s in SOURCE_NAME_MAP]
    settings = get_settings()
    return [SOURCE_NAME_MAP[s] for s in settings.MUSICDL_SOURCES if s in SOURCE_NAME_MAP]


LOSSLESS_EXTS = {"flac", "ape", "wav", "alac", "dsd", "dsf"}


def _parse_size_bytes(size_str) -> float:
    """解析 file_size 字符串('3.2M'/'1024K'/'5MB')为字节数,用于音质软排序。"""
    if not size_str:
        return 0.0
    s = str(size_str).strip().upper().replace("B", "")
    try:
        if s.endswith(("K",)):
            return float(s[:-1]) * 1024
        if s.endswith(("M",)):
            return float(s[:-1]) * 1024 * 1024
        if s.endswith(("G",)):
            return float(s[:-1]) * 1024 * 1024 * 1024
        return float(s)
    except Exception:
        return 0.0


def _quality_sort_key(song: dict, quality: str):
    """音质软排序键(配合 reverse=True):
    - lossless: 无损格式(flac 等)优先,再按体积降序
    - high:     体积大的高码率版本优先
    - standard: 非无损优先(省流),再按体积升序
    无效下载地址始终排后。
    """
    valid = 1 if song.get("with_valid_download_url") else 0
    ext = (song.get("ext") or "mp3").lower()
    size = _parse_size_bytes(song.get("file_size"))
    is_lossless = 1 if ext in LOSSLESS_EXTS else 0
    if quality == "lossless":
        return (valid, is_lossless, size)
    if quality == "standard":
        return (valid, 0 if is_lossless else 1, -size)
    # high(默认)
    return (valid, size)


def _song_to_dict(song_raw, source_name: str) -> dict | None:
    """将 musicdl 原始歌曲对象转为 dict，处理类型转换"""
    try:
        return SongInfo(
            song_name=song_raw.song_name,
            singers=song_raw.singers,
            album=song_raw.album or "",
            ext=song_raw.ext or "mp3",
            file_size=str(song_raw.file_size or ""),
            duration=str(song_raw.duration or ""),
            duration_s=song_raw.duration_s or 0,
            source=source_name,
            song_identifier=str(song_raw.identifier or ""),
            download_url=song_raw.download_url or "",
            cover_url=song_raw.cover_url or "",
            lyric=song_raw.lyric or "",
            with_valid_download_url=song_raw.with_valid_download_url,
        ).model_dump()
    except Exception as e:
        print(f"ERR constructing SongInfo for {getattr(song_raw, 'song_name', '?')}: {e}")
        return None


def _search_single_source(keyword: str, source_client_name: str) -> list[dict]:
    """搜索单个音乐源，返回去重后的歌曲列表"""
    from musicdl.musicdl import MusicClient
    init_cfg = {source_client_name: {"search_size_per_source": SEARCH_SIZE}}
    try:
        client = MusicClient(
            music_sources=[source_client_name],
            init_music_clients_cfg=init_cfg,
        )
        results = client.search(keyword)
    except Exception as e:
        print(f"Search error for {source_client_name}: {e}")
        traceback.print_exc()
        return []

    song_list = results.get(source_client_name, [])
    seen = set()
    songs = []
    for song in song_list:
        key = f"{song.song_name}_{song.singers}"
        if key in seen:
            continue
        seen.add(key)
        d = _song_to_dict(song, source_client_name)
        if d:
            songs.append(d)
    print(f"{source_client_name} returned {len(songs)} songs for '{keyword}'")
    return songs


def _do_search(keyword: str, sources: list[str] | None = None) -> list[SongInfo]:
    """原有同步搜索，用于缓存命中的场景"""
    actual_sources = _get_actual_sources(sources)
    if not actual_sources:
        return []

    all_songs = []
    from concurrent.futures import as_completed
    futures = {executor.submit(_search_single_source, keyword, src): src for src in actual_sources}
    for f in as_completed(futures, timeout=90):
        src = futures[f]
        try:
            songs = f.result()
            all_songs.extend(songs)
        except Exception as e:
            print(f"Source {src} error: {e}")

    all_songs.sort(key=lambda s: s.get("with_valid_download_url", False), reverse=True)
    print(f"_do_search('{keyword}'): {len(all_songs)} total songs from {len(actual_sources)} sources")
    return [SongInfo(**s) for s in all_songs]


@router.get("/search/suggestions")
async def search_suggestions(
    keyword: str = "",
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not keyword or len(keyword) < 1:
        return {"suggestions": []}

    # 先查 Redis 缓存
    cached = get_cached_suggestions(keyword)
    if cached:
        return {"suggestions": cached}

    # 从 play_logs 表中查询最近播放的匹配歌曲作为建议（无需全量搜索）
    try:
        from app.models.play_log import PlayLog
        from sqlalchemy import func, distinct
        suggestions: list[str] = []

        # 查询最近 7 天内匹配关键词的播放记录
        matching = db.query(distinct(PlayLog.song_name)).filter(
            PlayLog.user_id == user_id,
            PlayLog.played_at >= datetime.now() - timedelta(days=7),
            PlayLog.song_name.ilike(f"%{keyword}%"),
        ).order_by(PlayLog.played_at.desc()).limit(8).all()

        for row in matching:
            label = f"{row[0]} - "
            suggestions.append(label.strip())

        if len(suggestions) < 4:
            # 如果最近播放不够，从热门关键词中补充
            from app.utils.music import HOT_KEYWORDS
            for kw in HOT_KEYWORDS:
                if kw.startswith(keyword) or keyword in kw:
                    suggestions.append(kw)
                    if len(suggestions) >= 8:
                        break

    except Exception as e:
        print(f"Search suggestions DB error: {e}")
        suggestions = []

    result = suggestions[:8]
    if result:
        set_cached_suggestions(keyword, result)
    return {"suggestions": result}


@router.post("/search", response_model=SearchResponse)
async def search(
    req: SearchRequest,
    user_id: int = Depends(get_current_user),
):
    cached = get_cached_search(req.keyword, req.sources)
    if cached:
        quality = (req.quality or "high").lower()
        all_songs = sorted(cached, key=lambda s: _quality_sort_key(s, quality), reverse=True)
    else:
        loop = asyncio.get_event_loop()
        actual_sources = _get_actual_sources(req.sources)
        # 每音源独立 60 秒超时,并发搜索(慢音源不拖累快音源)
        async def search_one(src: str) -> list[dict]:
            try:
                return await asyncio.wait_for(
                    loop.run_in_executor(executor, _search_single_source, req.keyword, src),
                    timeout=60,
                )
            except asyncio.TimeoutError:
                print(f"Source {src} timed out after 60s")
                return []
            except Exception as e:
                print(f"Source {src} error: {e}")
                return []

        tasks = [asyncio.create_task(search_one(src)) for src in actual_sources]
        results = await asyncio.gather(*tasks)
        all_songs: list[dict] = []
        for songs in results:
            all_songs.extend(songs)
        quality = (req.quality or "high").lower()
        all_songs.sort(key=lambda s: _quality_sort_key(s, quality), reverse=True)
        if all_songs:
            set_cached_search(req.keyword, all_songs, req.sources)

    page = req.page
    page_size = req.page_size
    total = len(all_songs)
    start = (page - 1) * page_size
    end = start + page_size
    page_results = all_songs[start:end]

    return SearchResponse(
        keyword=req.keyword,
        results=page_results,
        total=total,
        page=page,
        page_size=page_size,
        has_more=end < total,
    )


@router.post("/search/stream")
async def search_stream(
    req: SearchRequest,
    request: Request,
    user_id: int = Depends(get_current_user),
):
    """SSE 流式搜索:优先返回缓存,未命中则逐源推送(客户端断开自动取消后台任务)"""
    actual_sources = _get_actual_sources(req.sources)
    quality = (req.quality or "high").lower()

    async def event_generator():
        # 先检查缓存
        cached = get_cached_search(req.keyword, req.sources)
        if cached:
            source_groups = {}
            for song in cached:
                src = song.get("source", "unknown")
                if src not in source_groups:
                    source_groups[src] = []
                source_groups[src].append(song)

            for src, songs in source_groups.items():
                songs.sort(key=lambda s: _quality_sort_key(s, quality), reverse=True)
                event_data = {
                    "source": src,
                    "source_display": SOURCE_DISPLAY_MAP.get(src, src),
                    "songs": songs,
                    "count": len(songs),
                    "elapsed": 0,
                    "total_so_far": sum(len(v) for v in source_groups.values()),
                }
                yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"

            done_data = {
                "done": True,
                "total": len(cached),
                "source_counts": {SOURCE_DISPLAY_MAP.get(k, k): len(v) for k, v in source_groups.items()},
                "from_cache": True,
            }
            yield f"data: {json.dumps(done_data, ensure_ascii=False)}\n\n"
            return

        # 缓存未命中，执行流式搜索
        all_songs = []
        source_counts = {}

        async def search_one(source_name: str):
            loop = asyncio.get_event_loop()
            t0 = time.time()
            try:
                songs = await asyncio.wait_for(
                    loop.run_in_executor(executor, _search_single_source, req.keyword, source_name),
                    timeout=60,
                )
            except asyncio.TimeoutError:
                print(f"Stream search {source_name} timed out after 60s")
                songs = []
            except Exception as e:
                print(f"Stream search {source_name} error: {e}")
                songs = []
            elapsed = round(time.time() - t0, 1)
            return source_name, songs, elapsed

        tasks = [asyncio.create_task(search_one(src)) for src in actual_sources]

        for coro in asyncio.as_completed(tasks):
            # 客户端断开则取消所有后台搜索任务,避免无效计算
            if await request.is_disconnected():
                for t in tasks:
                    if not t.done():
                        t.cancel()
                print(f"Client disconnected, cancelled {len(tasks)} search tasks")
                return

            try:
                source_name, songs, elapsed = await coro
            except Exception as e:
                print(f"Stream task error: {e}")
                continue

            all_songs.extend(songs)
            source_counts[source_name] = len(songs)

            sorted_songs = sorted(songs, key=lambda s: _quality_sort_key(s, quality), reverse=True)
            event_data = {
                "source": source_name,
                "source_display": SOURCE_DISPLAY_MAP.get(source_name, source_name),
                "songs": sorted_songs,
                "count": len(sorted_songs),
                "elapsed": elapsed,
                "total_so_far": len(all_songs),
            }
            yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"

        # 兜底清理未完成的任务
        for t in tasks:
            if not t.done():
                t.cancel()

        all_songs.sort(key=lambda s: _quality_sort_key(s, quality), reverse=True)

        if all_songs:
            set_cached_search(req.keyword, all_songs, req.sources)

        done_data = {
            "done": True,
            "total": len(all_songs),
            "source_counts": {SOURCE_DISPLAY_MAP.get(k, k): v for k, v in source_counts.items()},
        }
        yield f"data: {json.dumps(done_data, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sources")
def get_sources(user_id: int = Depends(get_current_user)):
    from app.utils.music import get_all_sources
    return {"sources": get_all_sources()}


@router.post("/refresh-url")
async def refresh_url(req: RefreshUrlRequest, user_id: int = Depends(get_current_user)):
    # 先查 Redis 缓存（24h TTL）
    cached_url = get_cached_url(req.source, req.song_identifier)
    if cached_url:
        return {"download_url": cached_url, "from_cache": True}

    loop = asyncio.get_event_loop()
    actual_source = SOURCE_NAME_MAP.get(req.source, req.source)
    keyword = f"{req.song_name} {req.singers}"

    def _find_match(songs: list[dict]) -> dict | None:
        for song in songs:
            if str(song.get("song_identifier")) == str(req.song_identifier) and song.get("with_valid_download_url"):
                return song
        for song in songs:
            if song.get("song_name") == req.song_name and song.get("with_valid_download_url"):
                return song
        return None

    # 先尝试原始音乐源
    matched = None
    try:
        songs = await loop.run_in_executor(executor, _search_single_source, keyword, actual_source)
        matched = _find_match(songs)
        if matched:
            set_cached_url(req.source, req.song_identifier, matched["download_url"])
    except Exception:
        pass

    # 原始源失败，依次尝试其他启用的源（最多 3 个）
    if not matched:
        settings = get_settings()
        fallback = [SOURCE_NAME_MAP[s] for s in settings.MUSICDL_SOURCES
                    if s in SOURCE_NAME_MAP and SOURCE_NAME_MAP[s] != actual_source]
        for src in fallback[:3]:
            try:
                songs = await loop.run_in_executor(executor, _search_single_source, keyword, src)
                matched = _find_match(songs)
                if matched:
                    set_cached_url(req.source, req.song_identifier, matched["download_url"])
                    break
            except Exception:
                continue

    if not matched:
        raise HTTPException(status_code=404, detail="无法获取下载链接，已尝试多个音乐源")

    return {
        "download_url": matched["download_url"],
        "cover_url": matched.get("cover_url"),
        "lyric": matched.get("lyric"),
    }


@router.get("/proxy")
async def proxy_download(url: str, user_id: int = Depends(get_current_user)):
    import httpx
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="下载失败")
        content_type = resp.headers.get("content-type", "audio/mpeg")
        return StreamingResponse(
            _stream(resp),
            media_type=content_type,
            headers={"Content-Disposition": "attachment"},
        )


async def _stream(resp):
    yield resp.content


HOT_KEYWORDS = [
    "周杰伦", "陈奕迅", "林俊杰", "薛之谦", "邓紫棋",
    "Taylor Swift", "告五人", "毛不易", "华晨宇", "BLACKPINK",
    "2026新歌", "抖音热歌", "宝藏歌曲", "经典老歌", "粤语金曲",
]

MOOD_KEYWORDS = {
    "happy": "欢快 流行 动感 快乐",
    "sad": "伤感 慢歌 抒情 心碎",
    "relax": "轻音乐 治愈 安静 放松",
    "sport": "运动 摇滚 热血 动感",
    "focus": "纯音乐 钢琴 轻柔 专注",
    "romantic": "浪漫 情歌 甜蜜 恋爱",
}


@router.get("/hot-songs")
async def get_hot_songs(
    keyword: str = Query(None),
    user_id: int = Depends(get_current_user),
):
    kw = keyword or HOT_KEYWORDS[hash(str(user_id) + str(datetime.now().date())) % len(HOT_KEYWORDS)]
    cached = get_cached_search(kw)
    if cached:
        return {"keyword": kw, "results": cached[:30]}
    loop = asyncio.get_event_loop()
    songs = await loop.run_in_executor(executor, _do_search, kw, None)
    if songs:
        set_cached_search(kw, [s.model_dump() for s in songs])
    return {"keyword": kw, "results": songs[:30]}


@router.get("/mood-radio")
async def mood_radio(
    mood: str = Query("happy", enum=["happy", "sad", "relax", "sport", "focus", "romantic"]),
    user_id: int = Depends(get_current_user),
):
    keyword = MOOD_KEYWORDS.get(mood, "流行")
    cached = get_cached_search(keyword)
    if cached:
        import random
        results = cached[:]
        random.shuffle(results)
        return {"mood": mood, "results": results[:30]}
    loop = asyncio.get_event_loop()
    songs = await loop.run_in_executor(executor, _do_search, keyword, None)
    if songs:
        set_cached_search(keyword, [s.model_dump() for s in songs])
    import random
    random.shuffle(songs)
    return {"mood": mood, "results": songs[:30]}
