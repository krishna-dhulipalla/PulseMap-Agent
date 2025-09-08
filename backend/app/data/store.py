# same content as your current store.py, just moved here
from __future__ import annotations
import json, sqlite3
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from pathlib import Path
from ..data.geo import haversine_km

Path("data").mkdir(exist_ok=True)
_CONN = sqlite3.connect("data/pulsemaps_reports.db", check_same_thread=False)
_CONN.execute("""
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  text TEXT NOT NULL,
  props_json TEXT,
  created_at TEXT NOT NULL
)
""")
_CONN.commit()

def _row_to_feature(row: tuple) -> Dict[str, Any]:
    _id, lat, lon, text, props_json, created_at = row
    props = {"type": "user_report", "text": text, "reported_at": created_at}
    if props_json:
        try: props.update(json.loads(props_json))
        except Exception: props["raw_props"] = props_json
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]}, "properties": props}

def add_report(lat: float, lon: float, text: str = "User report", props: dict | None = None):
    created_at = datetime.now(timezone.utc).isoformat()
    props = dict(props or {})
    props_json = json.dumps(props)
    cur = _CONN.execute(
        "INSERT INTO reports (lat, lon, text, props_json, created_at) VALUES (?,?,?,?,?)",
        (float(lat), float(lon), text, props_json, created_at)
    )
    _CONN.commit()
    rid = str(cur.lastrowid)  # ✅ new id

    # include rid in the immediate response so the UI can show counts instantly
    out_props = {"type": "user_report", "text": text, "reported_at": created_at, **props}
    out_props.setdefault("rid", rid)
    out_props.setdefault("id", rid)

    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [float(lon), float(lat)]},
        "properties": out_props,
    }

def get_feature_collection() -> Dict[str, Any]:
    cur = _CONN.execute("SELECT id, lat, lon, text, props_json, created_at FROM reports ORDER BY id DESC")
    feats = [_row_to_feature(r) for r in cur.fetchall()]
    return {"type": "FeatureCollection", "features": feats}

def find_reports_near(lat: float, lon: float, radius_km: float = 10.0, limit: int = 20, max_age_hours: Optional[int] = None) -> List[Dict[str, Any]]:
    params: list[Any] = []
    sql = "SELECT id, lat, lon, text, props_json, created_at FROM reports"
    if max_age_hours is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=int(max_age_hours))
        sql += " WHERE datetime(created_at) >= datetime(?)"
        params.append(cutoff.isoformat())
    sql += " ORDER BY id DESC LIMIT 2000"
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
    _CONN.execute("DELETE FROM reports")
    _CONN.commit()
    return {"ok": True, "message": "All reports cleared."}

def _row_to_feature(row: tuple) -> Dict[str, Any]:
    _id, lat, lon, text, props_json, created_at = row
    props = {"type": "user_report", "text": text, "reported_at": created_at}
    if props_json:
        try:
            props.update(json.loads(props_json))
        except Exception:
            props["raw_props"] = props_json
    # ✅ ensure a stable id is present on every returned feature
    props.setdefault("rid", str(_id))
    props.setdefault("id", str(_id))      # optional mirror
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": props,
    }

