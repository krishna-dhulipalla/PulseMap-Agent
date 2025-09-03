import httpx
import os, io, csv
import asyncio
import random
import httpx


# Keep URLs simple & stable; you can lift to config/env later.
USGS_ALL_HOUR = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"
NWS_ALERTS_ACTIVE = "https://api.weather.gov/alerts/active"
EONET_EVENTS_GEOJSON = "https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open&days=7"
DATASETS = ["VIIRS_NOAA20_NRT", "VIIRS_SNPP_NRT"]


import httpx

def _in_usa(lat: float, lon: float) -> bool:
    # CONUS
    if 24.5 <= lat <= 49.5 and -125.0 <= lon <= -66.0:
        return True
    # Alaska (rough)
    if 51.0 <= lat <= 71.0 and -170.0 <= lon <= -129.0:
        return True
    # Hawaii
    if 18.5 <= lat <= 22.5 and -161.0 <= lon <= -154.0:
        return True
    return False

async def fetch_json_once(
    url: str,
    headers: dict,
    *,
    connect_timeout: float = 3,
    read_timeout: float = 12,
):
    """
    Single attempt fetch; no retries, no delay.
    """
    timeout = httpx.Timeout(
        connect=connect_timeout,
        read=read_timeout,
        write=read_timeout,
        pool=connect_timeout,
    )
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        r = await client.get(url, headers=headers)
        r.raise_for_status()
        return r.json()

async def fetch_usgs_quakes_geojson():
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(USGS_ALL_HOUR, headers={"Accept":"application/geo+json"})
        r.raise_for_status()
        return r.json()

async def fetch_nws_alerts_geojson():
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(NWS_ALERTS_ACTIVE, headers={"Accept":"application/geo+json"})
        r.raise_for_status()
        return r.json()

async def fetch_eonet_events_geojson():
    return await fetch_json_once(
        EONET_EVENTS_GEOJSON,
        headers={"Accept": "application/geo+json"},
        connect_timeout=3,
        read_timeout=12,
    )
    
def _get_num(d: dict, *keys):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            try:
                return float(d[k])
            except Exception:
                pass
    raise KeyError("no numeric value")

async def _fetch_firms_csv_rows(key: str, dataset: str, hours: int = 1) -> list[dict]:
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{dataset}/world/{hours}"
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(url, headers={"Accept": "text/csv", "User-Agent": "PulseMap/1.0"})
        text = r.text or ""

    # Some FIRMS edges return text/plain or octet-stream; parse anyway
    # Strip BOM if present
    if text and text[:1] == "\ufeff":
        text = text[1:]

    # Try CSV parse
    try:
        reader = csv.DictReader(io.StringIO(text))
        rows = [row for row in reader]
    except Exception:
        rows = []

    # If we got nothing, surface first 200 chars to the caller for logging
    if not rows:
        return [{"__error__": (text[:200] if text else "empty response")}]

    return rows

async def fetch_firms_hotspots_geojson():
    """
    NASA FIRMS: returns GeoJSON FeatureCollection (Points).
    Requires env FIRMS_MAP_KEY. Tries NOAA-20 first, then SNPP. World, last 24h (1 day segment).
    """
    key = "95fa2dac8d20024aa6a17229dbf5ce74"
    if not key:
        return {"type": "FeatureCollection", "features": [], "_note": "Set FIRMS_MAP_KEY to enable."}

    errors = []
    for dataset in DATASETS:
        rows = await _fetch_firms_csv_rows(key, dataset, hours=1)
        if rows and "__error__" in rows[0]:
            errors.append(f"{dataset}: {rows[0]['__error__']}")
            continue

        feats = []
        for i, row in enumerate(rows):
            if i >= 1500:
                break
            try:
                lat = _get_num(row, "latitude", "LATITUDE", "lat", "LAT")
                lon = _get_num(row, "longitude", "LONGITUDE", "lon", "LON")
            except Exception:
                continue

            props = {
                "source": "FIRMS",
                "dataset": dataset,
                "acq_date": row.get("acq_date") or row.get("ACQ_DATE"),
                "acq_time": row.get("acq_time") or row.get("ACQ_TIME"),
                "instrument": row.get("instrument") or row.get("INSTRUMENT"),
                "confidence": row.get("confidence") or row.get("CONFIDENCE"),
                "frp": row.get("frp") or row.get("FRP"),
                "daynight": row.get("daynight") or row.get("DAYNIGHT"),
            }
            feats.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": props,
            })

        feats = [f for f in feats
         if _in_usa(f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0])]
        if feats:
            return {"type": "FeatureCollection", "features": feats, "_note": f"{dataset} ok, {len(feats)} points (USA only)"}

        # Try next dataset if this one returned 0 points
        errors.append(f"{dataset}: 0 rows or no valid coordinates")

    # If we got here, nothing worked
    return {"type": "FeatureCollection", "features": [], "_note": f"FIRMS empty. Details: {' | '.join(errors[:2])}"}