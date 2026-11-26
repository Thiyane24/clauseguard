from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .gemini_cloud import generate_counter_clause
from .redactor import scrub_pii
from .schemas import CounterClauseRequest, CounterClauseResponse
from .security import verify_firebase_security

app = FastAPI(title="ClauseGuard API", version="1.0.0")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Firebase-AppCheck"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "clauseguard-backend", "env": settings.env}


@app.post("/api/v1/counter-clause", response_model=CounterClauseResponse)
def create_counter_clause(
    payload: CounterClauseRequest,
    _claims: dict = Depends(verify_firebase_security),
) -> CounterClauseResponse:
    scrubbed = scrub_pii(payload.raw_text)
    try:
        generated = generate_counter_clause(
            clause_id=payload.clause_id,
            redacted_text=scrubbed.redacted_text,
            jurisdiction=payload.jurisdiction,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    safe_concern = scrub_pii(generated.legal_concern).redacted_text
    safe_counter = scrub_pii(generated.suggested_counter_clause).redacted_text

    return CounterClauseResponse(
        clause_id=payload.clause_id,
        redacted_text=scrubbed.redacted_text,
        pii_items_removed=scrubbed.pii_items_removed,
        risk_level=generated.risk_level,
        legal_concern=safe_concern,
        suggested_counter_clause=safe_counter,
        inference_source="CLOUD_GEMINI",
    )
