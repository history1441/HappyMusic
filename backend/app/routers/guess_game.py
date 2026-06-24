from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, desc
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import random
from app.database import get_db
from app.models.game_score import GameScore
from app.models.user import User
from app.models.play_log import PlayLog
from app.utils.auth import get_current_user
from app.services.ai import ai_guess_game_distractors

router = APIRouter(prefix="/api/game", tags=["猜歌游戏"])


class ScoreSubmit(BaseModel):
    score: int
    total_questions: int
    correct_count: int
    best_streak: int
    difficulty: str = "normal"


class AnswerRequest(BaseModel):
    song_name: str
    artist: str


class LeaderboardEntry(BaseModel):
    rank: int
    username: str
    score: int
    total_questions: int
    correct_count: int
    best_streak: int
    difficulty: str
    created_at: str


class GuessQuestion(BaseModel):
    id: int
    song_name: str
    artist: str
    duration: int
    preview_seconds: int
    options: List[dict]  # [{"song": "", "artist": ""}, ...]
    correct_index: int


class GameRound(BaseModel):
    question: GuessQuestion
    correct: bool
    streak: int


def mask_username(name: str) -> str:
    """脱敏：保留首尾字符，中间用***代替"""
    if not name:
        return "***"
    if len(name) <= 2:
        return name[0] + "*"
    return name[0] + "***" + name[-1]


@router.post("/start")
async def start_game(
    difficulty: str = Query("normal", regex="^(easy|normal|hard)$"),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """开始一局猜歌游戏，返回 10 道题目"""
    # 获取最近播放过的歌曲作为候选
    recent = db.query(PlayLog.song_name, PlayLog.singers, PlayLog.source,
                      PlayLog.song_identifier, PlayLog.duration_s).filter(
        PlayLog.user_id == user_id
    ).order_by(desc(PlayLog.played_at)).distinct(PlayLog.song_identifier).limit(100).all()

    if len(recent) < 4:
        return {"success": False, "message": "播放记录不足", "questions": []}

    # 随机选取 10 道题（或全部）
    num_questions = min(10, len(recent))
    selected = random.sample(recent, num_questions)

    questions = []
    for idx, song in enumerate(selected):
        # 用 AI 生成干扰项
        ai_options = await ai_guess_game_distractors(song.song_name, song.singers, difficulty)

        # 如果 AI 不可用，使用随机干扰项
        if not ai_options or len(ai_options) < 3:
            other_songs = [s for s in recent if s.song_name != song.song_name]
            distractors = random.sample(other_songs, min(3, len(other_songs)))
            options = [
                {"song": d.song_name, "artist": d.singers}
                for d in distractors
            ]
            # 补齐到 3 个
            while len(options) < 3:
                options.append({"song": "未知歌手", "artist": "未知歌曲"})
        else:
            options = [
                {"song": o.get("song", ""), "artist": o.get("artist", "")}
                for o in ai_options[:3]
            ]

        # 插入正确答案到随机位置
        correct_idx = random.randint(0, 3)
        options.insert(correct_idx, {
            "song": song.song_name,
            "artist": song.singers,
        })

        questions.append(GuessQuestion(
            id=idx,
            song_name="",  # 猜歌游戏中隐藏答案
            artist="",
            duration=song.duration_s or 30,
            preview_seconds=15,
            options=options,
            correct_index=correct_idx,
        ).model_dump())

    return {
        "success": True,
        "difficulty": difficulty,
        "total_questions": len(questions),
        "questions": questions,
    }


@router.post("/answer")
def submit_answer(
    req: AnswerRequest,
    question_id: int = Query(..., ge=0),
    selected_index: int = Query(..., ge=0, le=3),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """提交一道题的答案，返回是否正确"""
    # 这里简化处理，实际应该从 session 中获取题目
    # 目前只记录分数
    return {
        "correct": True,  # 占位，实际应由前端判断
        "question_id": question_id,
    }


@router.post("/score")
def submit_score(
    body: ScoreSubmit,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """提交游戏得分，仅当新分数更高时更新"""
    if body.score <= 0:
        return {"success": False, "message": "无效分数"}

    existing = db.query(GameScore).filter(
        GameScore.user_id == user_id,
        GameScore.difficulty == body.difficulty,
    ).first()

    if existing:
        if body.score > existing.score:
            existing.score = body.score
            existing.total_questions = body.total_questions
            existing.correct_count = body.correct_count
            existing.best_streak = body.best_streak
            existing.created_at = func.now()
            db.commit()
        return {"success": True, "best_score": max(existing.score, body.score), "updated": body.score > existing.score}

    record = GameScore(
        user_id=user_id,
        score=body.score,
        total_questions=body.total_questions,
        correct_count=body.correct_count,
        best_streak=body.best_streak,
        difficulty=body.difficulty,
    )
    db.add(record)
    db.commit()
    return {"success": True, "best_score": body.score, "updated": True}


@router.get("/leaderboard")
def get_leaderboard(
    difficulty: str = "normal",
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """获取排行榜：每个用户取最高分，按分数降序"""
    subq = db.query(
        GameScore.user_id,
        func.max(GameScore.score).label("best_score"),
    ).filter(GameScore.difficulty == difficulty).group_by(GameScore.user_id).subquery()

    rows = db.query(
        GameScore.user_id,
        GameScore.score,
        GameScore.total_questions,
        GameScore.correct_count,
        GameScore.best_streak,
        GameScore.difficulty,
        GameScore.created_at,
    ).join(
        subq,
        (GameScore.user_id == subq.c.user_id) & (GameScore.score == subq.c.best_score),
    ).filter(
        GameScore.difficulty == difficulty,
    ).order_by(
        desc(GameScore.score),
        GameScore.created_at,
    ).limit(limit).all()

    user_ids = [r[0] for r in rows]
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {u.id: u.username for u in users}

    seen = set()
    result: list[LeaderboardEntry] = []
    for r in rows:
        if r[0] in seen:
            continue
        seen.add(r[0])
        result.append(LeaderboardEntry(
            rank=len(result) + 1,
            username=mask_username(user_map.get(r[0], "???")),
            score=r[1],
            total_questions=r[2],
            correct_count=r[3],
            best_streak=r[4],
            difficulty=r[5],
            created_at=r[6].strftime("%Y-%m-%d %H:%M") if r[6] else "",
        ))

    return result


@router.get("/my-best")
def get_my_best(
    difficulty: str = "normal",
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户最高分"""
    best = db.query(GameScore).filter(
        GameScore.user_id == user_id,
        GameScore.difficulty == difficulty,
    ).order_by(desc(GameScore.score)).first()

    if not best:
        return {"best_score": 0, "total_questions": 0, "correct_count": 0, "best_streak": 0}

    return {
        "best_score": best.score,
        "total_questions": best.total_questions,
        "correct_count": best.correct_count,
        "best_streak": best.best_streak,
    }
