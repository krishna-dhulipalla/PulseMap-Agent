from __future__ import annotations
from fastapi import FastAPI, HTTPException, Body, UploadFile, File, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from math import isnan
from packages.utils.geo import haversine_km
import asyncio
from dateutil import parser as dtparser
from pathlib import Path
import os
from uuid import uuid4
from fastapi import HTTPException
import httpx

from packages.schemas.store import get_feature_collection
from packages.schemas import store
from packages.agents.chat_graph import run_chat
from packages.feeds.sources import (
    fetch_usgs_quakes_geojson, fetch_nws_alerts_geojson,
    fetch_eonet_events_geojson, fetch_firms_hotspots_geojson
)

app = FastAPI(title="PulseMap Agent – API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ---- Normalizers: turn various sources into a common Update dict ----
def _report_to_update(f: Dict[str, Any]) -> Dict[str, Any]:
    p = f.get("properties", {}) or {}
    lat = f["geometry"]["coordinates"][1]
    lon = f["geometry"]["coordinates"][0]
    return {
        "kind": "report",
        "title": p.get("title") or p.get("text") or "User report",
        "emoji": p.get("emoji") or "📝",
        "time": p.get("reported_at"),
        "lat": float(lat), "lon": float(lon),
        "severity": p.get("severity"),
        "sourceUrl": None,
        "raw": p,
    }

def _quake_to_update(f: Dict[str, Any]) -> Dict[str, Any]:
    p = f.get("properties", {}) or {}
    g = f.get("geometry", {}) or {}
    if g.get("type") != "Point": return None
    lon, lat = g["coordinates"][:2]
    title = p.get("place") or p.get("title") or "Earthquake"
    mag = p.get("mag") or p.get("Magnitude") or p.get("m")
    ts = p.get("time")  # may be ms since epoch
    if isinstance(ts, (int, float)) and not isnan(ts):
        time_iso = datetime.fromtimestamp(ts/1000, tz=timezone.utc).isoformat()
    else:
        time_iso = p.get("updated") if isinstance(p.get("updated"), str) else datetime.now(timezone.utc).isoformat()
    return {
        "kind": "quake",
        "title": title,
        "emoji": "💥",
        "time": time_iso,
        "lat": float(lat), "lon": float(lon),
        "severity": f"M{mag}" if mag is not None else None,
        "sourceUrl": p.get("url") or p.get("detail"),
        "raw": p,
    }

def _eonet_to_update(f: Dict[str, Any]) -> Dict[str, Any]:
    p = f.get("properties", {}) or {}
    g = f.get("geometry", {}) or {}
    if g.get("type") != "Point": return None
    lon, lat = g["coordinates"][:2]
    title = p.get("title") or p.get("category") or "Event"
    cat = (p.get("category") or (p.get("categories") or [{}])[0].get("title") or "").lower()
    if "wildfire" in cat: emoji = "🔥"
    elif "volcano" in cat: emoji = "🌋"
    elif "earthquake" in cat or "seismic" in cat: emoji = "💥"
    elif any(k in cat for k in ["storm","cyclone","hurricane","typhoon"]): emoji = "🌀"
    elif "flood" in cat: emoji = "🌊"
    elif "landslide" in cat: emoji = "🏔️"
    elif any(k in cat for k in ["ice","snow","blizzard"]): emoji = "❄️"
    elif any(k in cat for k in ["dust","smoke","haze"]): emoji = "🌫️"
    else: emoji = "⚠️"
    time_iso = p.get("time") or p.get("updated") or datetime.now(timezone.utc).isoformat()
    return {
        "kind": "eonet",
        "title": title,
        "emoji": emoji,
        "time": time_iso,
        "lat": float(lat), "lon": float(lon),
        "sourceUrl": p.get("link") or p.get("url"),
        "raw": p,
    }

def _firms_to_update(f: Dict[str, Any]) -> Dict[str, Any]:
    p = f.get("properties", {}) or {}
    g = f.get("geometry", {}) or {}
    if g.get("type") != "Point": return None
    lon, lat = g["coordinates"][:2]
    # FIRMS often has acquisition time/date fields; fall back to now.
    time_iso = p.get("acq_datetime") or p.get("acq_date") or datetime.now(timezone.utc).isoformat()
    sev = p.get("confidence") or p.get("brightness") or p.get("frp")
    return {
        "kind": "fire",
        "title": "Fire hotspot",
        "emoji": "🔥",
        "time": time_iso,
        "lat": float(lat), "lon": float(lon),
        "severity": sev,
        "sourceUrl": None,
        "raw": p,
    }

def _nws_to_updates(fc: Dict[str, Any]) -> list[Dict[str, Any]]:
    out = []
    for f in (fc.get("features") or []):
        p = f.get("properties", {}) or {}
        # Best effort: use polygon centroid if present; otherwise skip (no point)
        g = f.get("geometry", {}) or {}
        coords = None
        if g.get("type") == "Polygon":
            poly = g["coordinates"][0]
            if poly:
                lats = [c[1] for c in poly]; lons = [c[0] for c in poly]
                coords = (sum(lats)/len(lats), sum(lons)/len(lons))
        elif g.get("type") == "Point":
            coords = (g["coordinates"][1], g["coordinates"][0])
        if not coords: 
            continue
        sev = p.get("severity") or "Unknown"
        issued = p.get("effective") or p.get("onset") or p.get("sent") or datetime.now(timezone.utc).isoformat()
        out.append({
            "kind": "nws",
            "title": p.get("event") or "NWS Alert",
            "emoji": "⚠️",
            "time": issued,
            "lat": float(coords[0]), "lon": float(coords[1]),
            "severity": sev,
            "sourceUrl": p.get("@id") or p.get("id"),
            "raw": p,
        })
    return out

def _within(lat: float, lon: float, u: Dict[str, Any], radius_km: float) -> bool:
    return haversine_km((lat, lon), (u["lat"], u["lon"])) <= radius_km

def _is_recent(iso: str | None, max_age_hours: int) -> bool:
    if not iso: return False
    try:
        t = dtparser.isoparse(iso)
        if not t.tzinfo:
            t = t.replace(tzinfo=timezone.utc)
    except Exception:
        return False
    return (datetime.now(timezone.utc) - t).total_seconds() <= max_age_hours * 3600

async def asyncio_gather_feeds():
    usgs_task = fetch_usgs_quakes_geojson()
    nws_task = fetch_nws_alerts_geojson()
    eonet_task = fetch_eonet_events_geojson()
    firms_task = fetch_firms_hotspots_geojson()

    results = await asyncio.gather(
        usgs_task, nws_task, eonet_task, firms_task,
        return_exceptions=True
    )

    def ok(x):
        return {"features": []} if isinstance(x, Exception) or not x else x

    return {
        "usgs": ok(results[0]),
        "nws": ok(results[1]),
        "eonet": ok(results[2]),
        "firms": ok(results[3]),
    }


@app.get("/health")
def health():
    return {"ok": True, "time": datetime.now(timezone.utc).isoformat()}

# ---------- FEEDS ----------
@app.get("/feeds/usgs")
async def usgs():
    return {"data": await fetch_usgs_quakes_geojson()}

@app.get("/feeds/nws")
async def nws():
    return {"data": await fetch_nws_alerts_geojson()}

from fastapi import HTTPException
import httpx

@app.get("/feeds/eonet")
async def eonet():
    try:
        data = await fetch_eonet_events_geojson()
        return {"data": data}
    except httpx.ConnectTimeout:
        # upstream unreachable before TCP connect -> 504 makes intent clear
        raise HTTPException(status_code=504, detail="EONET upstream connect timeout")
    except httpx.ReadTimeout:
        raise HTTPException(status_code=504, detail="EONET upstream read timeout")
    except httpx.HTTPError as e:
        # any other HTTPX issue -> 502 Bad Gateway
        raise HTTPException(status_code=502, detail=f"EONET upstream error: {e.__class__.__name__}")

@app.get("/feeds/firms")
async def firms():
    return {"data": await fetch_firms_hotspots_geojson()}

# ---------- USER REPORTS ----------
@app.get("/reports")
def reports():
    return get_feature_collection()

# ---------- CHAT ----------
@app.post("/chat")
def chat(payload: Dict[str, Any] = Body(...)):
    """
    Body: {
      "message": str,
      "user_location": { "lat": float, "lon": float }?,
      "session_id": str?  
    }
    Returns: { reply, tool_used?, tool_result?, session_id }
    """
    msg = payload.get("message", "")
    user_loc = payload.get("user_location")
    session_id = payload.get("session_id") 
    photo_url = payload.get("photo_url")
    if not isinstance(msg, str) or not msg.strip():
        return {"reply": "Please type something.", "tool_used": None}
    return run_chat(msg.strip(), user_location=user_loc, session_id=session_id, photo_url=photo_url)

@app.post("/chat/reset")
def reset_chat(payload: Dict[str, Any] = Body(...)):
    sid = payload.get("session_id")
    if not sid:
        return {"ok": False, "error": "session_id required"}
    # For SqliteSaver, the simplest is to use a new session_id on the client.
    # Or, if you store metadata per thread, you can implement a purge here.
    return {"ok": True}

MILES_TO_KM = 1.609344

@app.get("/updates/local")
async def local_updates(lat: float, lon: float, radius_miles: float = 25.0, max_age_hours: int = 48, limit: int = 100):
    km = float(radius_miles) * MILES_TO_KM

    # 1) User reports within radius and < max_age_hours
    from packages.schemas.store import find_reports_near
    near_reports = find_reports_near(lat, lon, radius_km=km, limit=limit, max_age_hours=max_age_hours)
    updates = [_report_to_update(f) for f in near_reports]

    # 2) Feeds -> filter by distance + age
    feeds = await asyncio_gather_feeds()  # defined below
    now = datetime.now(timezone.utc)

    # USGS quakes
    for f in (feeds["usgs"].get("features") or []):
        u = _quake_to_update(f)
        if not u: continue
        if _is_recent(u["time"], max_age_hours) and _within(lat, lon, u, km):
            updates.append(u)

    # NWS alerts (pre-flattened)
    for u in _nws_to_updates(feeds["nws"]):
        if _is_recent(u["time"], max_age_hours) and _within(lat, lon, u, km):
            updates.append(u)

    # EONET
    for f in (feeds["eonet"].get("features") or []):
        u = _eonet_to_update(f)
        if not u: continue
        if _is_recent(u["time"], max_age_hours) and _within(lat, lon, u, km):
            updates.append(u)

    # FIRMS
    for f in (feeds["firms"].get("features") or []):
        u = _firms_to_update(f)
        if not u: continue
        if _is_recent(u["time"], max_age_hours) and _within(lat, lon, u, km):
            updates.append(u)

    # Sort newest first and cap
    updates.sort(key=lambda x: x["time"] or "", reverse=True)
    return {"count": min(len(updates), limit), "updates": updates[:limit]}

@app.get("/updates/global")
async def global_updates(limit: int = 200, max_age_hours: Optional[int] = None):
    # 1) Latest user reports (optionally filter by age)
    fc = get_feature_collection()
    reports = fc.get("features") or []
    rep_updates = [_report_to_update(f) for f in reports]
    # 2) Feeds (no distance filter)
    feeds = await asyncio_gather_feeds()
    nws_updates = _nws_to_updates(feeds["nws"])
    quake_updates = [_quake_to_update(f) for f in (feeds["usgs"].get("features") or []) if _quake_to_update(f)]
    eonet_updates = [_eonet_to_update(f) for f in (feeds["eonet"].get("features") or []) if _eonet_to_update(f)]
    firms_updates = [_firms_to_update(f) for f in (feeds["firms"].get("features") or []) if _firms_to_update(f)]

    updates = rep_updates + nws_updates + quake_updates + eonet_updates + firms_updates

    # Optional recency filter
    if max_age_hours is not None:
        updates = [u for u in updates if _is_recent(u["time"], max_age_hours)]

    updates.sort(key=lambda x: x["time"] or "", reverse=True)
    return {"count": min(len(updates), limit), "updates": updates[:limit]}

@app.post("/upload/photo")
async def upload_photo(request: Request, file: UploadFile = File(...)):
    # Accept only images, cap at ~5MB for hackathon
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed.")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]:
        ext = ".jpg"
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (max 5MB).")

    name = f"{uuid4().hex}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)

    # Absolute URL (works across ports/origins)
    base = str(request.base_url).rstrip("/")
    url = f"{base}/uploads/{name}"
    return {"ok": True, "url": url, "path": f"/uploads/{name}"}

@app.post("/reports/clear")
def clear_reports_api():
    """
    Deletes all user reports from the database.
    """
    return store.clear_reports()
