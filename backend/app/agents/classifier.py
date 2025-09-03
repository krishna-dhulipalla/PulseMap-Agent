# same content as your current classifier.py, but model name from settings
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, FewShotChatMessagePromptTemplate
from ..config.settings import settings

class ReportClassification(BaseModel):
    category: str = Field(..., description="taxonomy id like 'crime.gunshot'")
    label: str = Field(..., description="short human title")
    description: Optional[str] = Field(None, description="one sentence, no emojis")
    severity: Optional[str] = None
    confidence: float = Field(..., ge=0, le=1)

CATEGORY_TO_ICON = {
    "crime.gunshot": "3d-gun",
    "crime.robbery": "3d-robbery",
    "crime.sex_offender": "3d-sex",
    "crime.suspicious": "3d-alert",
    "incident.missing_person": "3d-user_search",
    "incident.lost_item": "3d-search",
    "incident.medical": "3d-ambulance",
    "incident.car_accident": "3d-car",
    "road.flood": "3d-flood",
    "road.blocked": "3d-traffic",
    "road.construction": "3d-construction",
    "help.general": "3d-help",
    "help.ride": "3d-ride",
    "other.unknown": "3d-info",
}

SYSTEM = ("You classify short community reports into a strict taxonomy. "
          "Return ONLY the schema fields. If unclear, choose other.unknown.")

EXAMPLES = [
  {"input": "I heard gunshots near 5th and Pine!",
   "output_json": '{"category":"crime.gunshot","label":"Gunshots reported","description":"Multiple shots heard near 5th and Pine.","severity":"high","confidence":0.9}'},
  {"input": "Car crash blocking the left lane on I-66",
   "output_json": '{"category":"incident.car_accident","label":"Car accident","description":"Crash reported blocking the left lane on I-66.","severity":"medium","confidence":0.85}'},
]

example_block = ChatPromptTemplate.from_messages([("human", "{input}"), ("ai", "{output_json}")])
prompt = ChatPromptTemplate.from_messages([
  ("system", SYSTEM),
  FewShotChatMessagePromptTemplate(example_prompt=example_block, examples=EXAMPLES),
  ("human", "{text}"),
])

_model = ChatOpenAI(model=settings.OPENAI_MODEL_CLASSIFIER, temperature=0).with_structured_output(ReportClassification)

def classify_report_text(text: str) -> ReportClassification:
    return (prompt | _model).invoke({"text": text})
