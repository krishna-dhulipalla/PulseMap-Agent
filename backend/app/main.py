from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .config.settings import settings

app = FastAPI(title="PulseMap Agent – API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# Static uploads
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOADS_DIR)), name="uploads")

# Routers
from .routers import chat, reports, feeds, uploads, config  # noqa
from .routers.feeds import updates as updates_router
app.include_router(chat.router)
app.include_router(reports.router)
app.include_router(feeds.router)
app.include_router(updates_router)  
app.include_router(uploads.router)
app.include_router(config.router) 

if settings.FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(settings.FRONTEND_DIST), html=True), name="spa")

@app.get("/health")
def health():
    from datetime import datetime, timezone
    return {"ok": True, "time": datetime.now(timezone.utc).isoformat()}
