import json
from datetime import datetime, timezone
from typing import Optional
from langchain.tools import tool
from .classifier import classify_report_text, CATEGORY_TO_ICON
from ..services.reports import add_report, find_reports_near

@tool("add_report")
def add_report_tool(lat: float, lon: float, text: str = "User report", photo_url: Optional[str] = None) -> str:
    """
    Add a user report as a map point (GeoJSON Feature).
    Returns a JSON string: {"ok": true, "feature": ...}
    """
    cls = classify_report_text(text or "User report")
    icon_name = CATEGORY_TO_ICON.get(cls.category, "3d-info")
    props = {
        "title": cls.label,
        "text": cls.description or (text.strip() if text else "User report"),
        "category": cls.category,
        "emoji": icon_name,
        "severity": cls.severity,
        "confidence": cls.confidence,
        "source": "user",
        "reported_at": datetime.now(timezone.utc).isoformat(),
    }
    if photo_url:
        props["photo_url"] = photo_url
    feat = add_report(float(lat), float(lon), text or cls.label, props=props)
    return json.dumps({"ok": True, "feature": feat})

@tool("find_reports_near")
def find_reports_near_tool(lat: float, lon: float, radius_km: float = 10.0, limit: int = 20) -> str:
    """
    Find user reports near a location.
    Returns a JSON string: {"ok": true, "count": N, "results": [Feature,...]}
    """
    res = find_reports_near(float(lat), float(lon), float(radius_km), int(limit))
    return json.dumps({"ok": True, "count": len(res), "results": res})

TOOLS = [add_report_tool, find_reports_near_tool]
