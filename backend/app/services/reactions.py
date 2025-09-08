# apps/api/services/reactions.py
from __future__ import annotations
from typing import Dict, Set, List, Literal
import asyncio

Action = Literal["verify", "clear"]

# In-memory store: rid -> {"verify": set(session_id), "clear": set(session_id)}
_REACTIONS: Dict[str, Dict[str, Set[str]]] = {}
_LOCK = asyncio.Lock()

def _buckets_for(rid: str) -> Dict[str, Set[str]]:
    b = _REACTIONS.get(rid)
    if not b:
        b = {"verify": set(), "clear": set()}
        _REACTIONS[rid] = b
    return b

async def react(rid: str, session_id: str, action: Action, value: bool):
    async with _LOCK:
        b = _buckets_for(rid)
        if action == "verify":
            if value:
                b["verify"].add(session_id); b["clear"].discard(session_id)
            else:
                b["verify"].discard(session_id)
        elif action == "clear":
            if value:
                b["clear"].add(session_id); b["verify"].discard(session_id)
            else:
                b["clear"].discard(session_id)
        return {
            "rid": rid,
            "verify_count": len(b["verify"]),
            "clear_count": len(b["clear"]),
            "me": {
                "verified": session_id in b["verify"],
                "cleared": session_id in b["clear"],
            },
        }

async def get_many(ids: List[str], session_id: str):
    out: Dict[str, dict] = {}
    async with _LOCK:
        for rid in ids:
            b = _buckets_for(rid)
            out[rid] = {
                "rid": rid,
                "verify_count": len(b["verify"]),
                "clear_count": len(b["clear"]),
                "me": {
                    "verified": session_id in b["verify"],
                    "cleared": session_id in b["clear"],
                },
            }
    return out