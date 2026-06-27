from datetime import datetime
from sqlalchemy import String, DateTime, Text, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class BuildRecord(Base):
    __tablename__ = "build_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    build_type: Mapped[str] = mapped_column(String(20), default="upload")  # upload / android / windows / ios / web
    version: Mapped[str] = mapped_column(String(20), default="")
    platform: Mapped[str] = mapped_column(String(20), default="")  # android / windows / ios / web
    changelog: Mapped[str] = mapped_column(Text, default="")
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="success")
    message: Mapped[str] = mapped_column(Text, default="")
    log: Mapped[str] = mapped_column(Text, default="")
    filename: Mapped[str] = mapped_column(String(255), default="")
    abi: Mapped[str] = mapped_column(String(20), default="")  # arm64-v8a / armeabi-v7a / x86_64 / universal(空=通用/未知)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    downloads: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
