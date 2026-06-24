from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ShareCreate(BaseModel):
    playlist_id: int


class ShareResponse(BaseModel):
    share_code: str
    playlist_name: str
    song_count: int
    created_at: datetime
    expire_at: Optional[datetime] = None


class ShareImport(BaseModel):
    share_code: str
