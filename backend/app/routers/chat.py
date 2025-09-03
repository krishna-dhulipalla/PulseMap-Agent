from fastapi import APIRouter, Body
from typing import Dict, Any, Optional

from ..services.chat_agent import run_chat

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("")
def chat(payload: Dict[str, Any] = Body(...)):
    """
    Body: { "message": str, "user_location": {lat,lon}?, "session_id"?: str, "photo_url"?: str }
    """
    msg = payload.get("message", "")
    if not isinstance(msg, str) or not msg.strip():
        return {"reply": "Please type something.", "tool_used": None}
    return run_chat(
        message=msg.strip(),
        user_location=payload.get("user_location"),
        session_id=payload.get("session_id"),
        photo_url=payload.get("photo_url"),
    )

@router.post("/reset")
def reset_chat(payload: Dict[str, Any] = Body(...)):
    sid = payload.get("session_id")
    if not sid:
        return {"ok": False, "error": "session_id required"}
    # Same guidance as before—client can rotate session_id for SqliteSaver threads.
    return {"ok": True}
