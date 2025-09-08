# apps/api/services/tracts.py
from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, Tuple, List
import geopandas as gpd
from shapely.geometry import box, mapping

BASE = Path(__file__).resolve().parent.parent
DATA_DIR = BASE / "census" 
SHAPEFILE = DATA_DIR / "cb_2024_us_tract_500k.shp"

_gdf: gpd.GeoDataFrame | None = None

def _ensure_loaded() -> None:
    global _gdf
    if _gdf is not None:
        return
    if not SHAPEFILE.exists():
        raise FileNotFoundError(f"Tracts shapefile not found at {SHAPEFILE}")

    gdf = gpd.read_file(SHAPEFILE).to_crs(epsg=4326)
    keep = [c for c in ("GEOID", "STATEFP", "NAME", "NAMELSAD") if c in gdf.columns]
    gdf = gdf[keep + ["geometry"]]

    # optional: simplify a bit to reduce payload size
    gdf["geometry"] = gdf["geometry"].simplify(0.0005, preserve_topology=True)

    # build spatial index lazily via gdf.sindex
    _gdf = gdf

def get_tracts_by_bbox(bbox: Tuple[float, float, float, float]) -> Dict[str, Any]:
    """
    bbox = (min_lon, min_lat, max_lon, max_lat)
    Returns GeoJSON FeatureCollection of tracts intersecting bbox.
    """
    _ensure_loaded()
    assert _gdf is not None

    minx, miny, maxx, maxy = bbox
    qpoly = box(minx, miny, maxx, maxy)

    # Use GeoPandas spatial index to get row indices (no identity headaches)
    sindex = _gdf.sindex  # builds on first access
    idx = list(sindex.query(qpoly, predicate="intersects"))

    feats: List[Dict[str, Any]] = []
    for i in idx:
        geom = _gdf.geometry.iat[i]
        if not geom.intersects(qpoly):
            continue
        row = _gdf.iloc[i]
        props = { "geoid": row.get("GEOID"),
                  "statefp": row.get("STATEFP"),
                  "name": row.get("NAME"),
                  "namelsad": row.get("NAMELSAD") }
        feats.append({
            "type": "Feature",
            "geometry": mapping(geom),  # or mapping(geom.intersection(qpoly)) to clip
            "properties": props
        })

    return {"type": "FeatureCollection", "features": feats}
