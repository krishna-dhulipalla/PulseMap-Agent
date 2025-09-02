# packages/agents/chat_graph.py
from __future__ import annotations
import json
import os, sqlite3
from pathlib import Path
from typing import Annotated, Dict, List, Optional, TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from langgraph.graph.message import add_messages

from langchain_openai import ChatOpenAI
from langchain.tools import tool
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage, ToolMessage

from packages.schemas.store import add_report as store_add, find_reports_near as store_find
from packages.agents.classifier import classify_report_text, CATEGORY_TO_ICON

from langgraph.checkpoint.sqlite import SqliteSaver 
from uuid import uuid4
from datetime import datetime, timezone

# Ensure data dir exists
Path("data").mkdir(exist_ok=True)

# Create a long-lived sqlite connection (thread-safe for FastAPI)
conn = sqlite3.connect("data/pulsemap_sessions.db", check_same_thread=False)

# ============= Tools =============

@tool("add_report")
def add_report_tool(
    lat: float,
    lon: float,
    text: str = "User report",
    photo_url: Optional[str] = None,
) -> str:
    """
    Add a user report as a map point (GeoJSON Feature).
    Returns a JSON string: {"ok": true, "feature": ...}
    """
    # 1) classify the text
    cls = classify_report_text(text or "User report")
    icon_name = CATEGORY_TO_ICON.get(cls.category, "info")
    # 2) enrich properties; keep original text for context
    props = {
        "title": cls.label,
        "text": cls.description or text.strip(),   # one-line description
        "category": cls.category,
        "emoji": icon_name,
        "severity": cls.severity,
        "confidence": cls.confidence,
        "source": "user",
        "reported_at": datetime.now(timezone.utc).isoformat()
    }
    if photo_url:                      
        props["photo_url"] = photo_url

    # 3) store (store.add_report now accepts props=)
    feat = store_add(float(lat), float(lon), text or cls.label, props=props)

    return json.dumps({"ok": True, "feature": feat})

@tool("find_reports_near")
def find_reports_near_tool(
    lat: float,
    lon: float,
    radius_km: float = 10.0,
    limit: int = 20,
) -> str:
    """
    Find user reports near a location.
    Returns a JSON string: {"ok": true, "count": N, "results": [Feature,...]}
    """
    res = store_find(float(lat), float(lon), float(radius_km), int(limit))
    return json.dumps({"ok": True, "count": len(res), "results": res})

TOOLS = [add_report_tool, find_reports_near_tool]

# ============= Model =============

model = ChatOpenAI(
    model="gpt-4o",
    temperature=0.2,
    openai_api_key=os.getenv("OPENAI_API_KEY"),
    streaming=True,   # fine even if you don't stream to the client yet
).bind_tools(TOOLS)

SYSTEM_PROMPT = """
You are PulseMap Agent — a calm, friendly assistant inside a live community map.  
You help people add reports and discover what’s happening around them.

### What to do
- If the user reports an incident (e.g. "flooded underpass here"), call `add_report(lat, lon, text, photo_url?)`.  
- If the user asks about nearby updates (e.g. "what’s near me?", "any reports here?"), call `find_reports_near(lat, lon, radius_km=?, limit=?)`.  
  • Default radius = 25 miles (~40 km). Default limit = 10.  
- If no coordinates in the message but `user_location` is provided, use that.  
- If a photo URL is available, pass it through.  

### How to answer
- Speak like a helpful neighbor, not a robot.  
- Use plain text only. No **bold**, no numbered lists, no markdown tables.  
- After a tool call, start with a quick recap then list items newest first using hyphen bullets.  
  *“I checked within 25 miles of your location and found 3 updates.”*  
For each item, one line like:
  - 🔫 Gunshot — Severity: High; Confidence: 0.9; Time: 2h ago; Source: User; Photo: yes  
- If nothing found:
  - “I didn’t find anything within 25 miles in the last 48 hours. Want me to widen the search?”

### Safety
- Keep a supportive tone. Do not dramatize.  
- End with situational advice when it makes sense (e.g. “Avoid driving through floodwater”).  
- Only mention calling 911 if the report itself clearly describes an urgent danger.  
- Never invent reports — summarize only what tools/feed data provide.  
"""


def _mk_messages(user_text: str, user_location: Optional[Dict[str, float]]) -> List[BaseMessage]:
    loc_hint = (
        f"User location (fallback): lat={user_location['lat']}, lon={user_location['lon']}"
        if (user_location and "lat" in user_location and "lon" in user_location)
        else "User location: unknown"
    )
    return [SystemMessage(content=SYSTEM_PROMPT + "\n" + loc_hint),
            HumanMessage(content=user_text)]

# ============= Agent State (with add_messages aggregator) =============

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    user_location: Optional[Dict[str, float]]
    photo_url: Optional[str] 

# ============= Nodes =============

def model_call(state: AgentState, config=None) -> AgentState:
    loc = state.get("user_location")
    loc_hint = (
        f"User location (fallback): lat={loc['lat']}, lon={loc['lon']}"
        if (loc and "lat" in loc and "lon" in loc) else "User location: unknown"
    )
    photo = state.get("photo_url") or ""
    photo_hint = f"Photo URL available: {photo}" if photo else "No photo URL in context."
    system = SystemMessage(
        content=SYSTEM_PROMPT + "\n" + loc_hint + "\n" + photo_hint + "\n"
                "Only call another tool if the user asks for more."
    )
    msgs = [system, *state["messages"]]
    ai_msg: AIMessage = model.invoke(msgs)
    return {"messages": [ai_msg]}


def should_continue(state: AgentState) -> str:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "continue"
    return "end"

# ============= Graph =============
graph = StateGraph(AgentState)

graph.add_node("agent", model_call)
graph.add_node("tools", ToolNode(tools=TOOLS))

graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_continue, {"continue": "tools", "end": END})
graph.add_edge("tools", "agent")

checkpointer = SqliteSaver(conn)
APP = graph.compile(checkpointer=checkpointer)

# ============= Public entry point =============
def run_chat(message: str, user_location: Optional[Dict[str, float]] = None,
             session_id: Optional[str] = None, photo_url: Optional[str] = None) -> Dict[str, any]:
    sid = session_id or str(uuid4())
    init: AgentState = {
        "messages": [HumanMessage(content=message)],
        "user_location": user_location,
        "photo_url": photo_url,            
    }
    cfg = {"configurable": {"thread_id": sid}}
    final: AgentState = APP.invoke(init, config=cfg)

    reply, tool_used, tool_result = "", None, None
    for m in final["messages"]:
        if isinstance(m, AIMessage):
            reply = m.content or reply
        elif isinstance(m, ToolMessage) and m.name in {"add_report", "find_reports_near"}:
            try:
                tool_used = m.name
                tool_result = json.loads(m.content) if isinstance(m.content, str) else m.content
            except Exception:
                tool_result = {"raw": m.content}

    return {"reply": reply, "tool_used": tool_used, "tool_result": tool_result, "session_id": sid}