import httpx
import os, io, csv

# Keep URLs simple & stable; you can lift to config/env later.
USGS_ALL_HOUR = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"
NWS_ALERTS_ACTIVE = "https://api.weather.gov/alerts/active"

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
    
EONET_EVENTS_GEOJSON = "https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open&days=7"

async def fetch_eonet_events_geojson():
    async with httpx.AsyncClient(timeout=12) as client:
        r = await client.get(EONET_EVENTS_GEOJSON, headers={"Accept": "application/json"})
        r.raise_for_status()
        return r.json()

async def fetch_firms_hotspots_geojson():
    """
    NASA FIRMS: converts CSV -> GeoJSON FeatureCollection (Points).
    Requires env FIRMS_MAP_KEY. Uses VIIRS NOAA-20, world, last 24h.
    """
    key = os.getenv("FIRMS_MAP_KEY")
    if not key:
        return {"type":"FeatureCollection","features":[],"_note":"Set FIRMS_MAP_KEY to enable."}

    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/VIIRS_NOAA20_NRT/world/1"
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(url, headers={"Accept":"text/csv"})
        r.raise_for_status()
        text = r.text

    feats = []
    reader = csv.DictReader(io.StringIO(text))
    # Keep it light (first 1500)
    for i, row in enumerate(reader):
        if i >= 1500: break
        try:
            lat = float(row["latitude"]); lon = float(row["longitude"])
        except Exception:
            continue
        props = {
            "source": "FIRMS",
            "acq_date": row.get("acq_date"),
            "acq_time": row.get("acq_time"),
            "instrument": row.get("instrument"),
            "confidence": row.get("confidence"),
            "frp": row.get("frp"),
            "daynight": row.get("daynight"),
        }
        feats.append({
            "type":"Feature",
            "geometry":{"type":"Point","coordinates":[lon,lat]},
            "properties": props
        })
    return {"type":"FeatureCollection","features":feats}
