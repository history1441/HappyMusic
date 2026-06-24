from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class PlaylistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = ""
    is_favorite: bool = False


class PlaylistUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None


class PlaylistSongAdd(BaseModel):
    song_name: str
    singers: str
    album: str = ""
    ext: str = "mp3"
    duration: int = 0
    file_size: str = ""
    source: str
    song_identifier: str
    lyric: str = ""
    cover_url: str = ""


class PlaylistSongResponse(BaseModel):
    id: int
    song_name: str
    singers: str
    album: str
    ext: str
    duration: int
    file_size: str = ""
    source: str
    song_identifier: str
    cover_url: str
    sort_order: int
    added_at: datetime

    class Config:
        from_attributes = True


class PlaylistResponse(BaseModel):
    id: int
    name: str
    description: str
    cover: str
    is_favorite: bool
    song_count: int
    created_at: datetime
    updated_at: datetime
    songs: list[PlaylistSongResponse] = []

    class Config:
        from_attributes = True
