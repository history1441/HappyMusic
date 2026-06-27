from pydantic import BaseModel, field_validator
from typing import Optional


class SongInfo(BaseModel):
    song_name: str
    singers: str
    album: str = ""
    ext: str = "mp3"
    file_size: str = ""
    duration: str = ""
    duration_s: int = 0
    source: str
    song_identifier: str
    download_url: str = ""
    cover_url: str = ""
    lyric: str = ""
    with_valid_download_url: bool = False

    @field_validator('song_identifier', 'file_size', 'duration', mode='before')
    @classmethod
    def coerce_to_str(cls, v):
        return str(v) if v is not None else ""

    @field_validator('duration_s', mode='before')
    @classmethod
    def coerce_int(cls, v):
        return int(float(v)) if v is not None else 0


class SearchRequest(BaseModel):
    keyword: str
    sources: Optional[list[str]] = None
    page: int = 1
    page_size: int = 20
    quality: Optional[str] = "high"


class SearchResponse(BaseModel):
    keyword: str
    results: list[SongInfo]
    total: int
    page: int = 1
    page_size: int = 20
    has_more: bool = False


class SourceResponse(BaseModel):
    id: str
    name: str
    enabled: bool = True


class RefreshUrlRequest(BaseModel):
    song_name: str
    singers: str
    source: str
    song_identifier: str
