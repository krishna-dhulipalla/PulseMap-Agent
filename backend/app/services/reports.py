from typing import Dict, Any, List, Optional
from ..data.store import add_report as _add, find_reports_near as _find

def add_report(lat: float, lon: float, text: str, props: dict | None = None) -> Dict[str, Any]:
    return _add(lat, lon, text, props)

def find_reports_near(lat: float, lon: float, radius_km: float, limit: int,
                      max_age_hours: Optional[int] = None) -> List[Dict[str, Any]]:
    return _find(lat, lon, radius_km, limit, max_age_hours=max_age_hours)
