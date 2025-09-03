import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Optional, List, Iterable, Tuple
from dateutil import parser as dtparser

from ..data.geo import haversine_km
from .fetchers import (
    fetch_usgs_quakes_geojson, fetch_nws_alerts_geojson,
    fetch_eonet_events_geojson, fetch_firms_hotspots_geojson
)

def _flatten_lonlats(coords: Any) -> List[Tuple[float, float]]:
    """Collect (lon, lat) pairs from nested coordinate arrays."""
    out: List[Tuple[float, float]] = []
    if not isinstance(coords, (list, tuple)):
        return out
    if len(coords) >= 2 and isinstance(coords[0], (int, float)) and isinstance(coords[1], (int, float)):
        # Single coordinate pair [lon, lat, ...]
        out.append((float(coords[0]), float(coords[1])))
    else:
        for c in coords:
            out.extend(_flatten_lonlats(c))
    return out

def _centroid_from_geom(geom: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    """Return (lon, lat) for any geometry by taking a simple average of all coords."""
    if not geom or "type" not in geom:
        return None
    gtype = geom.get("type")
    coords = geom.get("coordinates")

    # Fast path for Point
    if gtype == "Point" and isinstance(coords, (list, tuple)) and len(coords) >= 2:
        return (float(coords[0]), float(coords[1]))

    # Generic centroid for Polygon/MultiPolygon/LineString/etc.
    pts = _flatten_lonlats(coords)
    if not pts:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return (sum(xs) / len(xs), sum(ys) / len(ys))

def _mk_point_feature(lon: float, lat: float, props: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [float(lon), float(lat)]},
        "properties": props or {},
    }

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

def _quake_to_update(f: Dict[str, Any]) -> Dict[str, Any] | None:
    p = f.get("properties", {}) or {}
    g = f.get("geometry", {}) or {}
    if g.get("type") != "Point": return None
    lon, lat = g["coordinates"][:2]
    title = p.get("place") or p.get("title") or "Earthquake"
    mag = p.get("mag") or p.get("Magnitude") or p.get("m")
    ts = p.get("time")
    if isinstance(ts, (int, float)):
        time_iso = datetime.fromtimestamp(ts/1000, tz=timezone.utc).isoformat()
    else:
        time_iso = p.get("updated") if isinstance(p.get("updated"), str) else datetime.now(timezone.utc).isoformat()
    return {"kind": "quake", "title": title, "emoji": "💥", "time": time_iso,
            "lat": float(lat), "lon": float(lon), "severity": f"M{mag}" if mag is not None else None,
            "sourceUrl": p.get("url") or p.get("detail"), "raw": p}

def _eonet_to_update(f: Dict[str, Any]) -> Dict[str, Any] | None:
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
    return {"kind": "eonet", "title": title, "emoji": emoji, "time": time_iso,
            "lat": float(lat), "lon": float(lon), "sourceUrl": p.get("link") or p.get("url"), "raw": p}

def _firms_to_update(f: Dict[str, Any]) -> Dict[str, Any] | None:
    p = f.get("properties", {}) or {}
    g = f.get("geometry", {}) or {}
    if g.get("type") != "Point": return None
    lon, lat = g["coordinates"][:2]
    time_iso = p.get("acq_datetime") or p.get("acq_date") or datetime.now(timezone.utc).isoformat()
    sev = p.get("confidence") or p.get("brightness") or p.get("frp")
    return {"kind": "fire", "title": "Fire hotspot", "emoji": "🔥", "time": time_iso,
            "lat": float(lat), "lon": float(lon), "severity": sev, "sourceUrl": None, "raw": p}

def _within(lat: float, lon: float, u: Dict[str, Any], radius_km: float) -> bool:
    return haversine_km((lat, lon), (u["lat"], u["lon"])) <= radius_km

def _is_recent(iso: str | None, max_age_hours: int) -> bool:
    if not iso: return False
    try:
        t = dtparser.isoparse(iso)
        if not t.tzinfo: t = t.replace(tzinfo=timezone.utc)
    except Exception:
        return False
    return (datetime.now(timezone.utc) - t).total_seconds() <= max_age_hours * 3600

async def _gather_feeds():
    results = await asyncio.gather(
        fetch_usgs_quakes_geojson(), fetch_nws_alerts_geojson(),
        fetch_eonet_events_geojson(), fetch_firms_hotspots_geojson(),
        return_exceptions=True
    )
    def ok(x): return {"features": []} if isinstance(x, Exception) or not x else x
    return {"usgs": ok(results[0]), "nws": ok(results[1]), "eonet": ok(results[2]), "firms": ok(results[3])}

async def local_updates(lat: float, lon: float, radius_miles: float, max_age_hours: int, limit: int):
    from ..data.store import find_reports_near
    km = float(radius_miles) * 1.609344
    near_reports = find_reports_near(lat, lon, radius_km=km, limit=limit, max_age_hours=max_age_hours)
    updates: List[Dict[str, Any]] = [_report_to_update(f) for f in near_reports]
    feeds = await _gather_feeds()

    for f in (feeds["usgs"].get("features") or []):
        u = _quake_to_update(f)
        if u and _is_recent(u["time"], max_age_hours) and _within(lat, lon, u, km):
            updates.append(u)
    for u in _nws_to_updates(feeds["nws"]):
        if _is_recent(u["time"], max_age_hours) and _within(lat, lon, u, km):
            updates.append(u)
    for f in (feeds["eonet"].get("features") or []):
        u = _eonet_to_update(f)
        if u and _is_recent(u["time"], max_age_hours) and _within(lat, lon, u, km):
            updates.append(u)
    for f in (feeds["firms"].get("features") or []):
        u = _firms_to_update(f)
        if u and _is_recent(u["time"], max_age_hours) and _within(lat, lon, u, km):
            updates.append(u)

    updates.sort(key=lambda x: x["time"] or "", reverse=True)
    return {"count": min(len(updates), limit), "updates": updates[:limit]}

def _nws_to_updates(fc: Dict[str, Any]) -> list[Dict[str, Any]]:
    out: list[Dict[str, Any]] = []
    for f in (fc.get("features") or []):
        p = f.get("properties", {}) or {}
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
        out.append({"kind": "nws", "title": p.get("event") or "NWS Alert", "emoji": "⚠️",
                    "time": issued, "lat": float(coords[0]), "lon": float(coords[1]),
                    "severity": sev, "sourceUrl": p.get("@id") or p.get("id"), "raw": p})
    return out

async def global_updates(limit: int, max_age_hours: Optional[int]):
    from ..data.store import get_feature_collection
    fc = get_feature_collection()
    reports = fc.get("features") or []
    rep_updates = [_report_to_update(f) for f in reports]
    feeds = await _gather_feeds()
    nws_updates = _nws_to_updates(feeds["nws"])
    quake_updates = [_ for f in (feeds["usgs"].get("features") or []) if (_ := _quake_to_update(f))]
    eonet_updates = [_ for f in (feeds["eonet"].get("features") or []) if (_ := _eonet_to_update(f))]
    firms_updates = [_ for f in (feeds["firms"].get("features") or []) if (_ := _firms_to_update(f))]

    updates = rep_updates + nws_updates + quake_updates + eonet_updates + firms_updates
    if max_age_hours is not None:
        updates = [u for u in updates if _is_recent(u["time"], max_age_hours)]
    updates.sort(key=lambda x: x["time"] or "", reverse=True)
    return {"count": min(len(updates), limit), "updates": updates[:limit]}

async def eonet_geojson_points() -> Dict[str, Any]:
    """Always return Point features for EONET (polygon events -> centroid)."""
    fc = await fetch_eonet_events_geojson() or {}
    features = []
    for f in (fc.get("features") or []):
        g = f.get("geometry") or {}
        p = f.get("properties") or {}
        cen = _centroid_from_geom(g)
        if not cen:
            continue
        lon, lat = cen
        # Keep a stable, small prop set the map can style
        props = {
            "source": "eonet",
            "title": p.get("title") or p.get("category") or "Event",
            "emoji": "⚠️",  # the map can replace based on category if it wants
            "raw": p,
        }
        features.append(_mk_point_feature(lon, lat, props))
    return {"type": "FeatureCollection", "features": features}

async def firms_geojson_points() -> Dict[str, Any]:
    """Always return Point features for FIRMS (skip invalid rows)."""
    fc = await fetch_firms_hotspots_geojson() or {}
    features = []
    for f in (fc.get("features") or []):
        g = f.get("geometry") or {}
        p = f.get("properties") or {}
        cen = _centroid_from_geom(g)
        if not cen:
            # Some rows can be malformed; skip them
            continue
        lon, lat = cen
        props = {
            "source": "firms",
            "title": "Fire hotspot",
            "emoji": "🔥",
            "confidence": p.get("confidence"),
            "brightness": p.get("brightness"),
            "time": p.get("acq_datetime") or p.get("acq_date"),
            "raw": p,
        }
        features.append(_mk_point_feature(lon, lat, props))
    return {"type": "FeatureCollection", "features": features}
