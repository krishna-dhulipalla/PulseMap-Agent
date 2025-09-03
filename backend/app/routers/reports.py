from fastapi import APIRouter
from ..data.store import get_feature_collection, clear_reports

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("")
def reports():
    return get_feature_collection()

@router.post("/clear")
def clear_reports_api():
    return clear_reports()
