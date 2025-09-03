from pydantic import BaseModel, Field
from typing import Optional, List, Any

class UserLocation(BaseModel):
    lat: float
    lon: float

class ChatRequest(BaseModel):
    message: str
    user_location: Optional[UserLocation] = None
    session_id: Optional[str] = None
    photo_url: Optional[str] = None

class Update(BaseModel):
    kind: str
    title: str
    emoji: str
    time: Optional[str]
    lat: float
    lon: float
    severity: Optional[str] = None
    sourceUrl: Optional[str] = None
    raw: Any

class UpdatesResponse(BaseModel):
    count: int
    updates: List[Update]
