from __future__ import annotations
import json, sqlite3
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Tuple, Optional
from pathlib import Path
from packages.utils.geo import haversine_km

# Ensure data dir and DB
Path("data").mkdir(exist_ok=True)
_CONN = sqlite3.connect("data/pulsemaps_reports.db", check_same_thread=False)
_CONN.execute("""
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  text TEXT NOT NULL,
  props_json TEXT,           -- JSON string (emoji, category, severity, ...)
  created_at TEXT NOT NULL   -- ISO8601
)
""")
_CONN.commit()

def _row_to_feature(row: tuple) -> Dict[str, Any]:
    _id, lat, lon, text, props_json, created_at = row
    props = {"type": "user_report", "text": text, "reported_at": created_at}
    if props_json:
        try:
            props.update(json.loads(props_json))
        except Exception:
            props["raw_props"] = props_json
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": props,
    }

def add_report(lat: float, lon: float, text: str = "User report", props: dict | None = None):
    created_at = datetime.now(timezone.utc).isoformat()
    props_json = json.dumps(props or {})
    _CONN.execute(
        "INSERT INTO reports (lat, lon, text, props_json, created_at) VALUES (?,?,?,?,?)",
        (float(lat), float(lon), text, props_json, created_at)
    )
    _CONN.commit()
    # Return as GeoJSON Feature
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [float(lon), float(lat)]},
        "properties": {"type": "user_report", "text": text, "reported_at": created_at, **(props or {})},
    }

def get_feature_collection() -> Dict[str, Any]:
    cur = _CONN.execute("SELECT id, lat, lon, text, props_json, created_at FROM reports ORDER BY id DESC")
    feats = [_row_to_feature(r) for r in cur.fetchall()]
    return {"type": "FeatureCollection", "features": feats}

def find_reports_near(lat: float, lon: float, radius_km: float = 10.0, limit: int = 20, max_age_hours: Optional[int] = None) -> List[Dict[str, Any]]:
    # Load recent rows (optionally restrict age first for speed)
    params = []
    sql = "SELECT id, lat, lon, text, props_json, created_at FROM reports"
    if max_age_hours is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=int(max_age_hours))
        sql += " WHERE datetime(created_at) >= datetime(?)"
        params.append(cutoff.isoformat())
    sql += " ORDER BY id DESC LIMIT 2000"  # soft cap to avoid huge scans
    cur = _CONN.execute(sql, params)

    center = (lat, lon)
    cand = []
    for r in cur.fetchall():
        _, lat2, lon2, *_ = r
        d = haversine_km(center, (lat2, lon2))
        if d <= radius_km:
            cand.append((d, r))
    cand.sort(key=lambda x: x[0])
    out = [_row_to_feature(r) for _, r in cand[:max(1, limit)]]
    return out

def clear_reports() -> dict[str, any]:
    """Delete all rows from the reports table."""
    _CONN.execute("DELETE FROM reports")
    _CONN.commit()
    return {"ok": True, "message": "All reports cleared."}