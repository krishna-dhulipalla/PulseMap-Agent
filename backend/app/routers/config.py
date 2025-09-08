from fastapi import APIRouter
from ..config.settings import settings

router = APIRouter(prefix="/config", tags=["config"])

@router.get("/runtime")
def runtime_config():
    # Only the fields you need in the client
    return {"VITE_GOOGLE_MAPS_API_KEY": settings.google_maps_api_key,
            "VITE_GOOGLE_MAPS_MAP_ID": settings.google_maps_map_id}