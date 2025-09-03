from __future__ import annotations
from typing import Annotated, Dict, List, Optional, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from langgraph.graph.message import add_messages
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage, ToolMessage
from langgraph.checkpoint.sqlite import SqliteSaver
import sqlite3

from .tools import TOOLS
from ..config.settings import settings

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

# Long-lived sessions DB (same filename as before)
conn = sqlite3.connect(str(settings.SESSIONS_DB), check_same_thread=False)

model = ChatOpenAI(
    model=settings.OPENAI_MODEL_AGENT,
    temperature=0.2,
    openai_api_key=settings.OPENAI_API_KEY,
    streaming=True,
).bind_tools(TOOLS)

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    user_location: Optional[Dict[str, float]]
    photo_url: Optional[str]

def model_call(state: AgentState, config=None) -> AgentState:
    loc = state.get("user_location")
    loc_hint = f"User location (fallback): lat={loc['lat']}, lon={loc['lon']}" if (loc and 'lat' in loc and 'lon' in loc) else "User location: unknown"
    photo = state.get("photo_url") or ""
    photo_hint = f"Photo URL available: {photo}" if photo else "No photo URL in context."
    system = SystemMessage(content=SYSTEM_PROMPT + "\n" + loc_hint + "\n" + photo_hint + "\nOnly call another tool if the user asks for more.")
    msgs = [system, *state["messages"]]
    ai_msg: AIMessage = model.invoke(msgs)
    return {"messages": [ai_msg]}

def should_continue(state: AgentState) -> str:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "continue"
    return "end"

graph = StateGraph(AgentState)
graph.add_node("agent", model_call)
graph.add_node("tools", ToolNode(tools=TOOLS))
graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_continue, {"continue": "tools", "end": END})
graph.add_edge("tools", "agent")

checkpointer = SqliteSaver(conn)
APP = graph.compile(checkpointer=checkpointer)
