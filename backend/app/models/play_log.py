from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.database import Base


class PlayLog(Base):
    __tablename__ = "play_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    song_name = Column(String(200), nullable=False)
    singers = Column(String(200), nullable=False)
    album = Column(String(200), default="")
    source = Column(String(50), nullable=False)
    song_identifier = Column(String(200), nullable=False)
    duration_s = Column(Float, default=0)
    played_duration = Column(Float, default=0)
    cover_url = Column(String(500), default="")
    platform = Column(String(20), default="web")
    played_at = Column(DateTime, server_default=func.now(), index=True)

    # Composite indexes for analytics queries
    __table_args__ = (
        Index('idx_playlog_user_played', 'user_id', 'played_at'),
        Index('idx_playlog_user_song', 'user_id', 'song_identifier'),
        Index('idx_playlog_user_source', 'user_id', 'source'),
    )
