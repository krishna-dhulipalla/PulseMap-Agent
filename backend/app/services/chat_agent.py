from typing import Dict, Any, Optional
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from ..agents.graph import APP

def run_chat(message: str,
             user_location: Optional[Dict[str, float]] = None,
             session_id: Optional[str] = None,
             photo_url: Optional[str] = None) -> Dict[str, Any]:
    from uuid import uuid4
    sid = session_id or str(uuid4())
    init = {"messages": [HumanMessage(content=message)], "user_location": user_location, "photo_url": photo_url}
    cfg = {"configurable": {"thread_id": sid}}
    final = APP.invoke(init, config=cfg)

    reply, tool_used, tool_result = "", None, None
    for m in final["messages"]:
        if isinstance(m, AIMessage):
            reply = m.content or reply
        elif isinstance(m, ToolMessage) and getattr(m, "name", None) in {"add_report", "find_reports_near"}:
            import json
            try:
                tool_used = m.name
                tool_result = json.loads(m.content) if isinstance(m.content, str) else m.content
            except Exception:
                tool_result = {"raw": m.content}
    return {"reply": reply, "tool_used": tool_used, "tool_result": tool_result, "session_id": sid}
