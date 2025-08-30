from typing import Dict, Any

def to_geojson_feature(lat: float, lon: float, properties: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": properties
    }
