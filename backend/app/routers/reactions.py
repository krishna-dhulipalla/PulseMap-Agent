# apps/api/routes/reports.py
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Literal, List
from ..services.reactions import react as svc_react, get_many as svc_get_many

router = APIRouter(prefix="/reports", tags=["reports"])

class ReactBody(BaseModel):
    action: Literal["verify", "clear"]
    value: bool
    session_id: str

@router.post("/{rid}/react")
async def react_route(rid: str, body: ReactBody):
    return await svc_react(rid, body.session_id, body.action, body.value)

@router.get("/reactions")
async def reactions(ids: str = Query(...), session_id: str = Query(...)):
    id_list: List[str] = [i for i in ids.split(",") if i]
    if not id_list: raise HTTPException(status_code=400, detail="ids required")
    return await svc_get_many(id_list, session_id)
