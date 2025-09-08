from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve repo root no matter where uvicorn is launched from
REPO_ROOT = Path(__file__).resolve().parents[3]

def _default_data_dir() -> Path:
    return (REPO_ROOT / "data").resolve()

def _default_uploads_dir() -> Path:
    return (_default_data_dir() / "uploads").resolve()

def _default_frontend_dist() -> Path:
    return (REPO_ROOT / "web" / "dist").resolve()

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    # Models / API keys
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL_AGENT: str = "gpt-4o"
    OPENAI_MODEL_CLASSIFIER: str = "gpt-4o-mini"

    # Paths (env may override with absolute or relative; we resolve below)
    DATA_DIR: Path = Field(default_factory=_default_data_dir)
    REPORTS_DB: Path = Field(default_factory=lambda: _default_data_dir() / "pulsemaps_reports.db")
    SESSIONS_DB: Path = Field(default_factory=lambda: _default_data_dir() / "pulsemap_sessions.db")
    UPLOADS_DIR: Path = Field(default_factory=_default_uploads_dir)
    FRONTEND_DIST: Path = Field(default_factory=_default_frontend_dist)

    # Defaults
    DEFAULT_RADIUS_KM: float = 40.0
    DEFAULT_LIMIT: int = 10
    MAX_AGE_HOURS: int = 48

    # Optional extras you had in .env
    firms_map_key: str | None = None
    gdacs_rss_url: str | None = "https://www.gdacs.org/xml/rss.xml"
    nvidia_api_key: str | None = None

    def ensure_dirs(self) -> None:
        # Resolve in case env provided relative strings
        self.DATA_DIR = self.DATA_DIR.resolve()
        self.UPLOADS_DIR = self.UPLOADS_DIR.resolve()
        # Create everything robustly
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings()
settings.ensure_dirs()
