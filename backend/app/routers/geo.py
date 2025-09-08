# apps/api/routes/geo.py
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from ..services.tracts import get_tracts_by_bbox

router = APIRouter(prefix="/geo", tags=["geo"])

@router.get("/tracts")
def tracts(bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat")):
    try:
        minx, miny, maxx, maxy = [float(x) for x in bbox.split(",")]
    except Exception:
        raise HTTPException(status_code=400, detail="bbox must be minLon,minLat,maxLon,maxLat")
    return get_tracts_by_bbox((minx, miny, maxx, maxy))
