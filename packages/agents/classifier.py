# packages/agents/classifier.py
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, FewShotChatMessagePromptTemplate

class ReportClassification(BaseModel):
    category: str = Field(..., description="taxonomy id like 'crime.gunshot', 'incident.medical', 'road.construction', 'help.ride', 'other.unknown'")
    label: str = Field(..., description="short human title, e.g., 'Gunshots reported'")
    severity: Optional[str] = None
    confidence: float = Field(..., ge=0, le=1)

CATEGORY_TO_ICON = {
    "crime.gunshot": "gun",                # gun icon
    "crime.robbery": "user-x",             # user-x icon (robber representation)
    "crime.assault": "shield-alert",       # shield-alert for assault
    "crime.suspicious": "alert-triangle",  # suspicious activity
    "incident.missing_person": "user-search", # missing person
    "incident.lost_item": "search",        # search icon
    "incident.medical": "ambulance",       # ambulance
    "incident.car_accident": "car",        # car icon
    "road.blocked": "traffic-cone",        # traffic cone
    "road.construction": "construction",   # construction icon
    "help.general": "help-circle",         # help circle
    "help.ride": "car-front",              # ride request
    "other.unknown": "info",               # info
}

SYSTEM = """You classify short community reports into a strict taxonomy.
Return ONLY the fields in the schema. If unclear, choose other.unknown."""

# Use JSON strings in the few-shots so the model imitates JSON, not Python dicts
EXAMPLES = [
  {"input": "I heard gunshots near 5th and Pine!", 
   "output_json": '{"category":"crime.gunshot","label":"Gunshots reported","severity":"high","confidence":0.9}'},
  {"input": "Car crash blocking the left lane on I-66", 
   "output_json": '{"category":"incident.car_accident","label":"Car accident","severity":"medium","confidence":0.85}'},
  {"input": "Grand Ave closed for road work", 
   "output_json": '{"category":"road.construction","label":"Road work","severity":"info","confidence":0.8}'},
  {"input": "Need a ride from the mall to downtown", 
   "output_json": '{"category":"help.ride","label":"Ride request","severity":"low","confidence":0.8}'},
  {"input": "Someone’s bag lost near the library", 
   "output_json": '{"category":"incident.lost_item","label":"Lost item","severity":"low","confidence":0.7}'},
  {"input": "Not sure what happened, big police presence", 
   "output_json": '{"category":"crime.suspicious","label":"Police activity","severity":"unknown","confidence":0.6}'},
]

example_block = ChatPromptTemplate.from_messages([
  ("human", "{input}"),
  ("ai", "{output_json}"),
])

prompt = ChatPromptTemplate.from_messages([
  ("system", SYSTEM),
  FewShotChatMessagePromptTemplate(example_prompt=example_block, examples=EXAMPLES),
  ("human", "{text}"),
])

# Enforce structured output directly from the model
_model = ChatOpenAI(model="gpt-4o-mini", temperature=0).with_structured_output(ReportClassification)

def classify_report_text(text: str) -> ReportClassification:
  # returns a ReportClassification instance (no manual parser needed)
  return (prompt | _model).invoke({"text": text})