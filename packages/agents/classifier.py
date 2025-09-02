# packages/agents/classifier.py
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, FewShotChatMessagePromptTemplate

class ReportClassification(BaseModel):
    category: str = Field(..., description="taxonomy id like 'crime.gunshot'")
    label: str = Field(..., description="short human title, e.g. 'Gunshots reported'")
    description: Optional[str] = Field(
        None, description="one-sentence summary in plain English; no emojis"
    )
    severity: Optional[str] = None
    confidence: float = Field(..., ge=0, le=1)

CATEGORY_TO_ICON = {
    "crime.gunshot": "3d-gun",                # gun icon
    "crime.robbery": "3d-robbery",             # user-x icon (robber representation)
    "crime.sex_offender": "3d-sex",       # shield-alert for assault
    "crime.suspicious": "3d-alert",  # suspicious activity
    "incident.missing_person": "3d-user_search", # missing person
    "incident.lost_item": "3d-search",        # search icon
    "incident.medical": "3d-ambulance",       # ambulance
    "incident.car_accident": "3d-car",        # car icon
    "road.flood": "3d-flood",               # flood icon
    "road.blocked": "3d-traffic",        # traffic cone
    "road.construction": "3d-construction",   # construction icon
    "help.general": "3d-help",         # help circle
    "help.ride": "3d-ride",              # ride request
    "other.unknown": "3d-info",               # info
}

SYSTEM = """You classify short community reports into a strict taxonomy.
Return ONLY the fields in the schema. If unclear, choose other.unknown.
- 'label' is a short human title (e.g., 'Gunshots reported').
- 'description' is a single sentence, friendly and clear, no emojis, no markdown.
"""

# Use JSON strings in the few-shots so the model imitates JSON, not Python dicts
EXAMPLES = [
  {"input": "I heard gunshots near 5th and Pine!",
   "output_json": '{"category":"crime.gunshot","label":"Gunshots reported","description":"Multiple shots heard near 5th and Pine.","severity":"high","confidence":0.9}'},
  {"input": "Car crash blocking the left lane on I-66",
   "output_json": '{"category":"incident.car_accident","label":"Car accident","description":"Crash reported blocking the left lane on I-66.","severity":"medium","confidence":0.85}'},
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