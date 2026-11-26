from typing import Literal
from pydantic import BaseModel, Field


class CounterClauseRequest(BaseModel):
    clause_id: str = Field(..., min_length=1, max_length=128, pattern=r"^[a-zA-Z0-9_-]+$")
    raw_text: str = Field(..., min_length=5, max_length=15000)
    jurisdiction: Literal[
        "Malaysia", "Singapore", "United Kingdom", "United States", "General"
    ] = "Malaysia"


class CounterClauseResponse(BaseModel):
    clause_id: str
    redacted_text: str
    pii_items_removed: int
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    legal_concern: str
    suggested_counter_clause: str
    inference_source: Literal["CLOUD_GEMINI"] = "CLOUD_GEMINI"


class GeminiCounterClauseOutput(BaseModel):
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    legal_concern: str
    suggested_counter_clause: str
