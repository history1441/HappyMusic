import asyncio
import os
from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.play_log import PlayLog
from app.utils.auth import get_current_user
from app.config import get_settings
from app.services.ai import (
    ai_recommend, ai_mood_analysis, ai_semantic_search,
    ai_guess_game_distractors, ai_comfort, ai_mood_playlist,
    generate_tts,
)
from app.routers.search import _do_search, executor
from app.utils.redis import get_cached_search, set_cached_search

router = APIRouter(prefix="/api/ai", tags=["AI功能"])
settings = get_settings()


class SemanticSearchRequest(BaseModel):
    query: str


@router.get("/recommend")
async def recommend(
    count: int = Query(10, ge=1, le=30),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get user play history
    history = db.query(
        PlayLog.song_name, PlayLog.singers,
        func.count(PlayLog.id).label("plays"),
    ).filter(PlayLog.user_id == user_id)\
     .group_by(PlayLog.song_name, PlayLog.singers)\
     .order_by(func.count(PlayLog.id).desc()).limit(30).all()

    history_list = [{"song_name": r[0], "singers": r[1], "plays": r[2]} for r in history]

    # Get favorites (most repeated songs)
    favorites = [f"{r[0]} - {r[1]}" for r in history[:10]]

    # Get skip data (songs played very briefly)
    skips = db.query(PlayLog.song_name).filter(
        PlayLog.user_id == user_id,
        PlayLog.played_duration < 10,
    ).limit(5).all()
    skip_songs = [r[0] for r in skips]

    if not history_list:
        return {"recommendations": [], "message": "播放更多歌曲后即可获得AI推荐"}

    # Check if AI is configured
    if not getattr(settings, "AI_BASE_URL", ""):
        # Fallback: return random popular songs
        return await _fallback_recommend(history_list, count)

    result = await ai_recommend(history_list, favorites, skip_songs, count)
    return result


async def _fallback_recommend(history: list[dict], count: int):
    """Fallback when AI is not configured."""
    if not history:
        return {"recommendations": []}
    top = history[0]
    keyword = f"{top['singers']} {top['song_name']}"
    try:
        # 先查 Redis 缓存
        cached = get_cached_search(keyword)
        if cached:
            recs = []
            for s in cached[:count]:
                recs.append({
                    "song": s.get("song_name", ""),
                    "artist": s.get("singers", ""),
                    "reason": f"与你喜欢的{top['singers']}风格相近",
                })
            return {"recommendations": recs}
        loop = asyncio.get_event_loop()
        songs = await loop.run_in_executor(executor, _do_search, keyword, None)
        recs = []
        for s in songs[:count]:
            recs.append({
                "song": s.song_name,
                "artist": s.singers,
                "reason": f"与你喜欢的{top['singers']}风格相近",
            })
        return {"recommendations": recs}
    except Exception:
        return {"recommendations": []}


class MoodRequest(BaseModel):
    song_name: str
    singers: str
    lyrics: str = ""


@router.post("/mood")
async def mood_analysis(req: MoodRequest, user_id: int = Depends(get_current_user)):
    if not getattr(settings, "AI_BASE_URL", ""):
        return {"mood": "未知", "score": 0.5, "commentary": "", "emoji": "🎵", "ai_enabled": False}

    result = await ai_mood_analysis(req.song_name, req.singers, req.lyrics)
    result["ai_enabled"] = True
    return result


@router.post("/semantic-search")
async def semantic_search(
    req: SemanticSearchRequest,
    user_id: int = Depends(get_current_user),
):
    if not getattr(settings, "AI_BASE_URL", ""):
        return {"results": [], "ai_enabled": False, "message": "AI未配置，请使用普通搜索"}

    # First do a broad search to get candidate songs
    try:
        cached = get_cached_search(req.query)
        if cached:
            song_dicts = [{"song_name": s.get("song_name", ""), "singers": s.get("singers", ""),
                           "source": s.get("source", ""), "song_identifier": s.get("song_identifier", "")}
                          for s in cached]
        else:
            loop = asyncio.get_event_loop()
            songs = await loop.run_in_executor(executor, _do_search, req.query, None)
            song_dicts = [{"song_name": s.song_name, "singers": s.singers, "source": s.source,
                           "song_identifier": s.song_identifier} for s in songs]
    except Exception:
        return {"results": [], "ai_enabled": True}

    matched = await ai_semantic_search(req.query, song_dicts)
    return {"results": matched, "ai_enabled": True}


@router.get("/guess-distractors")
async def guess_distractors(
    song_name: str = Query(...),
    singers: str = Query(...),
    difficulty: str = Query("normal"),
    user_id: int = Depends(get_current_user),
):
    if not getattr(settings, "AI_BASE_URL", ""):
        return {"options": [], "ai_enabled": False}

    options = await ai_guess_game_distractors(song_name, singers, difficulty)
    return {"options": options, "ai_enabled": True}


@router.get("/status")
def ai_status(user_id: int = Depends(get_current_user)):
    return {
        "enabled": bool(getattr(settings, "AI_BASE_URL", "")),
        "provider": getattr(settings, "AI_PROVIDER", "openai"),
        "model": getattr(settings, "AI_MODEL", ""),
        "base_url_set": bool(getattr(settings, "AI_BASE_URL", "")),
    }


class ComfortRequest(BaseModel):
    current_song: dict | None = None
    voice: str | None = None


@router.post("/comfort")
async def comfort(
    req: ComfortRequest | None = None,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """生成安慰文案 + TTS 语音。"""
    # 获取最近 24h 播放记录
    from datetime import datetime, timedelta
    cutoff = datetime.now() - timedelta(hours=24)
    recent = db.query(
        PlayLog.song_name, PlayLog.singers,
    ).filter(
        PlayLog.user_id == user_id,
        PlayLog.played_at >= cutoff,
    ).order_by(PlayLog.played_at.desc()).limit(20).all()

    recent_plays = [{"song_name": r[0], "singers": r[1]} for r in recent]

    if not getattr(settings, "AI_BASE_URL", ""):
        return {"text": "", "audio_url": None, "ai_enabled": False}

    text = await ai_comfort(recent_plays, req.current_song if req else None)
    audio_path = None
    if text:
        voice = (req.voice if req else None) or "zh-CN-XiaoxiaoNeural"
        audio_path = await generate_tts(text, voice)

    audio_url = None
    if audio_path:
        audio_url = f"/api/ai/tts-file/{os.path.basename(audio_path)}"

    return {"text": text, "audio_url": audio_url, "ai_enabled": True}


@router.get("/tts-file/{filename}")
async def serve_tts_file(filename: str):
    """提供 TTS 音频文件。"""
    from app.services.ai import TTS_DIR
    filepath = os.path.join(TTS_DIR, filename)
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="audio/mpeg", filename=filename)
    return {"error": "not found"}


class MoodPlaylistRequest(BaseModel):
    mood: str
    current_list: list[str] | None = None


@router.post("/mood-playlist")
async def mood_playlist(
    req: MoodPlaylistRequest,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI 心情电台：生成歌单。"""
    if not getattr(settings, "AI_BASE_URL", ""):
        return {"songs": [], "ai_enabled": False}

    # 用户播放统计
    top_artists = db.query(
        PlayLog.singers, func.count(PlayLog.id).label("cnt"),
    ).filter(PlayLog.user_id == user_id)\
     .group_by(PlayLog.singers).order_by(func.count(PlayLog.id).desc()).limit(10).all()

    recent_songs = db.query(
        PlayLog.song_name, PlayLog.singers,
    ).filter(PlayLog.user_id == user_id)\
     .order_by(PlayLog.played_at.desc()).limit(15).all()

    user_stats = {
        "top_artists": [r[0] for r in top_artists],
        "recent_songs": [f"{r[0]} - {r[1]}" for r in recent_songs],
    }

    songs = await ai_mood_playlist(req.mood, user_stats, req.current_list)
    return {"songs": songs, "ai_enabled": True}
