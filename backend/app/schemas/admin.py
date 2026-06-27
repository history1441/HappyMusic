from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminUserResponse(BaseModel):
    id: int
    username: str
    nickname: str
    avatar: str
    role: str
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminUserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)
    nickname: str = ""
    role: str = "user"


class AdminUserUpdate(BaseModel):
    nickname: Optional[str] = None
    role: Optional[str] = None
    avatar: Optional[str] = None


class AdminRoleUpdate(BaseModel):
    role: str


class AdminPasswordReset(BaseModel):
    new_password: str = Field(min_length=6, max_length=100)


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = ""
    type: str = "info"
    is_pinned: bool = False
    publish_at: Optional[datetime] = None


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    type: Optional[str] = None
    is_pinned: Optional[bool] = None
    publish_at: Optional[datetime] = None


class ConfigUpdate(BaseModel):
    values: dict[str, str]
