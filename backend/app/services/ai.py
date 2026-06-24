import httpx
import json
import os
import asyncio
import uuid
from app.config import get_settings

settings = get_settings()


async def _call_openai(messages: list[dict], model: str, temperature: float, max_tokens: int) -> str:
    """调用 OpenAI 兼容 API (Chat Completions)。"""
    ai_base = settings.AI_BASE_URL.rstrip("/")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.AI_API_KEY}",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "thinking": {"type": "disabled"},
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(f"{ai_base}/chat/completions", headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        msg = data["choices"][0]["message"]
        # 兼容思考模型: content 可能为空，fallback 到 reasoning_content
        return msg.get("content") or msg.get("reasoning_content") or ""


async def _call_anthropic(messages: list[dict], model: str, temperature: float, max_tokens: int) -> str:
    """调用 Anthropic Messages API。"""
    ai_base = settings.AI_BASE_URL.rstrip("/")
    # Anthropic Messages API 需要 system 单独传，从 messages 中提取
    system_text = ""
    user_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_text = msg["content"]
        else:
            user_messages.append(msg)

    headers = {
        "Content-Type": "application/json",
        "x-api-key": settings.AI_API_KEY,
        "anthropic-version": "2023-06-01",
    }
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": user_messages,
    }
    if system_text:
        payload["system"] = system_text

    url = ai_base
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        # Anthropic 返回格式: {"content": [{"type": "text", "text": "..."}]}
        contents = data.get("content", [])
        return contents[0]["text"] if contents else ""


async def call_llm(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> str:
    """统一的 LLM 调用入口，根据 AI_PROVIDER 自动选择 API 格式。

    返回 LLM 的原始响应文本。如果配置缺失或调用失败，返回空字符串 ""。
    调用方应通过检查结果来判断 AI 是否可用。
    """
    if not settings.AI_BASE_URL:
        return ""

    provider = getattr(settings, "AI_PROVIDER", "openai").lower()
    model = model or settings.AI_MODEL

    try:
        if provider == "anthropic":
            return await _call_anthropic(messages, model, temperature, max_tokens)
        else:
            return await _call_openai(messages, model, temperature, max_tokens)
    except httpx.TimeoutException:
        import logging
        logging.getLogger().error(f"LLM call timeout (provider={provider}, model={model})")
        return ""
    except httpx.HTTPStatusError as e:
        import logging
        logging.getLogger().error(f"LLM call HTTP error (status={e.response.status_code}): {e}")
        return ""
    except Exception as e:
        import logging
        logging.getLogger().error(f"LLM call failed (provider={provider}, model={model}): {e}")
        return ""


async def ai_recommend(
    user_history: list[dict],
    user_favorites: list[str],
    skip_songs: list[str],
    count: int = 10,
) -> dict:
    history_str = "\n".join(
        f"- {h['song_name']} by {h['singers']} (播放{h.get('plays', 1)}次)"
        for h in user_history[:30]
    )
    fav_str = ", ".join(user_favorites[:10]) if user_favorites else "无"
    skip_str = ", ".join(skip_songs[:5]) if skip_songs else "无"

    messages = [
        {"role": "system", "content": "你是一位专业的音乐推荐师。请根据用户的听歌历史推荐歌曲。返回JSON格式：{\"recommendations\": [{\"song\": \"歌名\", \"artist\": \"歌手\", \"reason\": \"推荐理由\"}]}。注意：不要推荐用户已经听过的歌曲，不要重复推荐同一首歌。"},
        {"role": "user", "content": f"""用户最近播放：
{history_str}

收藏标签：{fav_str}
跳过歌曲：{skip_str}

请推荐{count}首该用户可能喜欢的歌曲，风格多样但与现有偏好相关。不要推荐用户已经听过的歌曲，不要重复。只返回JSON，不要其他文字。"""}
    ]

    try:
        result = await call_llm(messages, temperature=0.8)
        start = result.find("{")
        end = result.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(result[start:end])
            recs = data.get("recommendations", [])
            # 去重：按 (song, artist) 组合
            seen = set()
            unique_recs = []
            for r in recs:
                key = (r.get("song", "").strip().lower(), r.get("artist", "").strip().lower())
                if key not in seen:
                    seen.add(key)
                    unique_recs.append(r)
            return {"recommendations": unique_recs[:count]}
    except Exception:
        pass
    return {"recommendations": []}


async def ai_mood_analysis(
    song_name: str,
    singers: str,
    lyrics: str = "",
) -> dict:
    lyrics_preview = lyrics[:500] if lyrics else "暂无歌词"

    messages = [
        {"role": "system", "content": "你是音乐情感分析师。分析歌曲情绪并生成串场文案。返回JSON：{\"mood\": \"情绪\", \"score\": 0.8, \"commentary\": \"一段温暖的串场文案(30字内)\", \"emoji\": \"😊\"}"},
        {"role": "user", "content": f"歌曲：{song_name} - {singers}\n歌词片段：{lyrics_preview}"}
    ]

    try:
        result = await call_llm(messages, temperature=0.6, max_tokens=300)
        start = result.find("{")
        end = result.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(result[start:end])
    except Exception:
        pass
    return {"mood": "未知", "score": 0.5, "commentary": "", "emoji": "🎵"}


async def ai_semantic_search(query: str, song_list: list[dict]) -> list[dict]:
    songs_str = "\n".join(
        f"{i+1}. {s['song_name']} - {s['singers']}"
        for i, s in enumerate(song_list[:50])
    )

    messages = [
        {"role": "system", "content": "你是音乐搜索助手。根据用户查询，从歌曲列表中找出语义最相关的歌曲。返回JSON：{\"indices\": [1,3,5]} (歌曲编号列表，按相关度排序)"},
        {"role": "user", "content": f"查询：{query}\n\n歌曲列表：\n{songs_str}"}
    ]

    try:
        result = await call_llm(messages, temperature=0.3, max_tokens=100)
        start = result.find("{")
        end = result.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(result[start:end])
            indices = data.get("indices", [])
            return [song_list[i - 1] for i in indices if 0 < i <= len(song_list)]
    except Exception:
        pass
    return []


async def ai_comfort(
    recent_plays: list[dict],
    current_song: dict | None = None,
) -> str:
    """生成温暖的安慰文案。"""
    plays_str = "\n".join(
        f"- {p['song_name']} ({p['singers']})"
        for p in recent_plays[:20]
    )
    current_str = ""
    if current_song:
        current_str = f"\n当前正在听：{current_song.get('song_name', '')} - {current_song.get('singers', '')}"
        if current_song.get('lyric'):
            current_str += f"\n歌词片段：{current_song['lyric'][:300]}"

    messages = [
        {"role": "system", "content": "你是一位温暖的音乐伴侣。根据用户最近的听歌记录和当前歌曲，生成1-2句温暖的话，安慰或鼓励用户。语气要自然、亲切，像朋友聊天一样。不要用emoji。直接返回文字，不要JSON。"},
        {"role": "user", "content": f"用户最近24小时听了这些歌：\n{plays_str}{current_str}\n\n请给用户说一句温暖的话。"}
    ]

    try:
        result = await call_llm(messages, temperature=0.8, max_tokens=200)
        return result.strip() if result else ""
    except Exception:
        return ""


async def ai_mood_playlist(
    mood: str,
    user_stats: dict,
    current_list: list[str] | None = None,
) -> list[dict]:
    """根据心情和用户偏好生成播放列表建议。"""
    top_artists = user_stats.get("top_artists", [])
    recent_genres = user_stats.get("recent_songs", [])

    artists_str = "、".join(top_artists[:10]) if top_artists else "未知"
    recent_str = "\n".join(f"- {s}" for s in recent_genres[:15]) if recent_genres else "无"
    current_str = ""
    if current_list:
        current_str = f"\n已有播放列表（不要重复）：\n" + "\n".join(f"- {s}" for s in current_list[:15])

    mood_desc = {
        "happy": "开心欢快", "sad": "伤感治愈", "relax": "放松舒缓",
        "sport": "运动激昂", "focus": "专注平静", "romantic": "浪漫温馨",
    }

    messages = [
        {"role": "system", "content": "你是音乐电台DJ。根据用户心情和偏好生成歌曲推荐。优先推荐中文歌曲（华语流行、粤语经典），也可以推荐少量知名英文歌曲。只推荐真实存在的知名歌曲。返回JSON：{\"songs\": [{\"song_name\": \"歌名\", \"singers\": \"歌手\"}]}"},
        {"role": "user", "content": f"""用户心情：{mood_desc.get(mood, mood)}
用户常听歌手：{artists_str}
用户最近在听：
{recent_str}{current_str}

请推荐15首适合该心情的歌曲，考虑用户的音乐偏好。优先中文歌曲，少量英文。只返回JSON。"""}
    ]

    try:
        result = await call_llm(messages, temperature=0.9, max_tokens=1500)
        start = result.find("{")
        end = result.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(result[start:end])
            return data.get("songs", [])
    except Exception:
        pass
    return []


async def ai_guess_game_distractors(
    correct_song: str,
    correct_artist: str,
    difficulty: str = "normal",
) -> list[dict]:
    diff_desc = {"easy": "非常不同风格", "normal": "相似风格", "hard": "非常相似"}
    messages = [
        {"role": "system", "content": "你是猜歌游戏出题师。生成3个干扰选项。返回JSON：{\"options\": [{\"song\": \"歌名\", \"artist\": \"歌手\"}]}"},
        {"role": "user", "content": f"正确答案：{correct_song} - {correct_artist}\n难度：{difficulty}（干扰项应与正确答案{diff_desc.get(difficulty, '相似')}）\n请生成3个干扰选项。"}
    ]

    try:
        result = await call_llm(messages, temperature=0.9, max_tokens=300)
        start = result.find("{")
        end = result.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(result[start:end]).get("options", [])
    except Exception:
        pass
    return []


# --- TTS ---

TTS_DIR = os.environ.get("HAPPYMUSIC_TTS_DIR", "/app/tts_cache")


async def generate_tts(text: str, voice: str = "zh-CN-XiaoxiaoNeural") -> str | None:
    """使用 edge-tts 生成语音文件，返回文件路径。"""
    try:
        import edge_tts
        import time

        os.makedirs(TTS_DIR, exist_ok=True)

        # 清理超过 2 小时的旧 TTS 文件
        now = time.time()
        for f in os.listdir(TTS_DIR):
            fp = os.path.join(TTS_DIR, f)
            if os.path.isfile(fp) and now - os.path.getmtime(fp) > 7200:
                try:
                    os.remove(fp)
                except OSError:
                    pass

        filename = f"{uuid.uuid4().hex}.mp3"
        filepath = os.path.join(TTS_DIR, filename)

        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(filepath)

        return filepath
    except Exception as e:
        import logging
        logging.getLogger().warning(f"edge-tts failed: {e}")
        return None
