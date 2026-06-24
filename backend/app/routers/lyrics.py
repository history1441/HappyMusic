from fastapi import APIRouter, Depends, Query
from app.utils.auth import get_current_user
from app.services.lyrics import fetch_lyrics

router = APIRouter(prefix="/api", tags=["歌词"])


@router.get("/lyrics")
async def get_lyrics(
    song_name: str = Query(..., min_length=1),
    singers: str = Query("", description="歌手名"),
    source: str = Query("", description="来源平台"),
    user_id: int = Depends(get_current_user),
):
    """获取精准时间轴LRC歌词，支持网易云/QQ/酷狗"""
    lrc = await fetch_lyrics(song_name, singers, source)
    return {"lyric": lrc}
