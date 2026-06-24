from pydantic import BaseModel
from typing import Optional


class PlayLogCreate(BaseModel):
    song_name: str
    singers: str
    album: str = ""
    source: str
    song_identifier: str
    duration_s: float = 0
    played_duration: float = 0
    platform: str = "web"
    cover_url: str = ""


class StatsSummary(BaseModel):
    total_plays: int = 0
    total_time_hours: float = 0
    unique_songs: int = 0
    unique_artists: int = 0
    top_song: Optional[str] = None
    top_artist: Optional[str] = None
    top_source: Optional[str] = None


class RankingItem(BaseModel):
    name: str
    count: int
    extra: str = ""


class PreferenceDimension(BaseModel):
    label: str
    value: float


class MonthlyData(BaseModel):
    month: str
    plays: int
    hours: float


class AnnualReport(BaseModel):
    year: int
    total_plays: int
    total_hours: float
    unique_songs: int
    unique_artists: int
    top_songs: list[RankingItem]
    top_artists: list[RankingItem]
    monthly: list[MonthlyData]
    source_distribution: list[RankingItem]
