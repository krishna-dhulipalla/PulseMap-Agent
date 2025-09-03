from math import radians, sin, cos, asin, sqrt
from typing import Tuple

def haversine_km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Distance in km between (lat,lon) points a, b."""
    lat1, lon1 = a
    lat2, lon2 = b
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    lat1r, lat2r = radians(lat1), radians(lat2)
    h = sin(dlat/2)**2 + cos(lat1r)*cos(lat2r)*sin(dlon/2)**2
    return 2 * R * asin(sqrt(h))
