from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
import os, tempfile

REPO_ROOT = Path(__file__).resolve().parents[3]

def _writable_dir(candidates: list[Path]) -> Path:
    for p in candidates:
        try:
            p.mkdir(parents=True, exist_ok=True)
            t = p / ".write_test"
            t.write_text("ok", encoding="utf-8")
            t.unlink(missing_ok=True)
            return p.resolve()
        except Exception:
            continue
    raise RuntimeError(f"No writable data dir from: {candidates!r}")

def _default_data_dir() -> Path:
    candidates: list[Path] = []
    env = os.getenv("DATA_DIR")
    if env:
        candidates.append(Path(env))
    # Prefer the standard mount on Docker/HF (if writable)
    candidates.append(Path("/data"))
    # Local dev
    candidates.append(REPO_ROOT / "data")
    # Last resort
    candidates.append(Path(tempfile.gettempdir()) / "pulsemaps" / "data")
    return _writable_dir(candidates)

def _default_frontend_dist() -> Path:
    return (REPO_ROOT / "web" / "dist").resolve()

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL_AGENT: str = "gpt-4o"
    OPENAI_MODEL_CLASSIFIER: str = "gpt-4o-mini"

    DATA_DIR: Path = Field(default_factory=_default_data_dir)
    REPORTS_DB: Path | None = None
    SESSIONS_DB: Path | None = None
    UPLOADS_DIR: Path | None = None
    FRONTEND_DIST: Path = Field(default_factory=_default_frontend_dist)

    DEFAULT_RADIUS_KM: float = 40.0
    DEFAULT_LIMIT: int = 10
    MAX_AGE_HOURS: int = 48

    firms_map_key: str | None = None
    gdacs_rss_url: str | None = "https://www.gdacs.org/xml/rss.xml"
    nvidia_api_key: str | None = None
    
    google_maps_api_key: str | None = Field(default=None, alias="VITE_GOOGLE_MAPS_API_KEY")
    google_maps_map_id: str | None = Field(default=None, alias="VITE_GOOGLE_MAPS_MAP_ID")
    

    def ensure_dirs(self) -> None:
        if self.REPORTS_DB is None:
            self.REPORTS_DB = self.DATA_DIR / "pulsemaps_reports.db"
        if self.SESSIONS_DB is None:
            self.SESSIONS_DB = self.DATA_DIR / "pulsemap_sessions.db"
        if self.UPLOADS_DIR is None:
            self.UPLOADS_DIR = self.DATA_DIR / "uploads"

        # Make & resolve
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        self.REPORTS_DB = self.REPORTS_DB.resolve()
        self.SESSIONS_DB = self.SESSIONS_DB.resolve()
        self.UPLOADS_DIR = self.UPLOADS_DIR.resolve()

settings = Settings()
settings.ensure_dirs()