from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class JobCreateResponse(BaseModel):
    job_id: str
    message: str = "İş kuyruğa alındı."


JobStatusLiteral = Literal["pending", "processing", "needs_review", "completed", "failed"]


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatusLiteral
    source_language: str | None = None
    transcription_data: str | None = None
    ai_analysis: str | None = None
    target_languages: list[str] = Field(default_factory=list)
    error_message: str | None = None
    created_at: datetime
    downloads: dict[str, dict[str, str]] = Field(default_factory=dict)


class UploadForm(BaseModel):
    """Placeholder — multipart handled in route."""

    pass
