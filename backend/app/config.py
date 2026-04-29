from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    redis_url: str = "redis://localhost:6379/0"
    database_url: str = "sqlite:///./data/app.db"
    upload_dir: Path = Path("./data/uploads")
    output_dir: Path = Path("./data/outputs")
    whisper_model: str = "medium"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    ffmpeg_bin: str = "ffmpeg"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    task_mode: str = "auto"  # auto | celery | local
    gemini_api_key: str = ""
    ai_analysis_enabled: bool = True


settings = Settings()
