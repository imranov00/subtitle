import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text, Boolean
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class JobStatus:
    pending = "pending"
    processing = "processing"
    needs_review = "needs_review"
    completed = "completed"
    failed = "failed"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    status = Column(String(32), default=JobStatus.pending, nullable=False)
    original_filename = Column(String(512), nullable=False)
    video_path = Column(String(1024), nullable=False)
    source_language = Column(String(16), nullable=True)
    target_languages_json = Column(Text, default="[]", nullable=False)
    word_level = Column(Boolean, default=False, nullable=False)
    editor_mode = Column(Boolean, default=False, nullable=False)
    font = Column(String(100), nullable=True)
    video_quality = Column(String(50), nullable=True)
    transcription_data = Column(Text, nullable=True)
    ai_analysis_json = Column(Text, nullable=True)
    smart_mode = Column(Boolean, default=False, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
