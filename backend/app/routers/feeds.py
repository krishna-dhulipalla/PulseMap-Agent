from fastapi import APIRouter, HTTPException
from typing import Any, Dict, Optional
from ..services.feeds import (
    fetch_usgs_quakes_geojson, fetch_nws_alerts_geojson,
    eonet_geojson_points, firms_geojson_points, 
    local_updates as _local_updates, global_updates as _global_updates
)

router = APIRouter(prefix="/feeds", tags=["feeds"])

@router.get("/usgs")
async def usgs():
    return {"data": await fetch_usgs_quakes_geojson()}

@router.get("/nws")
async def nws():
    return {"data": await fetch_nws_alerts_geojson()}

@router.get("/eonet")
async def eonet():
    return {"data": await eonet_geojson_points()}

@router.get("/firms")
async def firms():
    # Return pointified features for map markers
    return {"data": await firms_geojson_points()}

# Convenience endpoints parallel to your previous design
updates = APIRouter(prefix="/updates", tags=["updates"])

@updates.get("/local")
async def local_updates(lat: float, lon: float, radius_miles: float = 25.0,
                        max_age_hours: int = 48, limit: int = 100):
    return await _local_updates(lat, lon, radius_miles, max_age_hours, limit)

@updates.get("/global")
async def global_updates(limit: int = 200, max_age_hours: Optional[int] = None):
    return await _global_updates(limit, max_age_hours)

router.include_router(updates)
