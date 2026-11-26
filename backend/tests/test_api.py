from fastapi.testclient import TestClient
from app.main import app
from app.schemas import GeminiCounterClauseOutput

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_counter_clause_contract(monkeypatch):
    def fake_generate(clause_id: str, redacted_text: str, jurisdiction: str):
        assert "940822-10-6142" not in redacted_text
        return GeminiCounterClauseOutput(
            risk_level="HIGH",
            legal_concern="Excessive penalty exceeds standard notice-period compensation.",
            suggested_counter_clause=(
                "4. EARLY TERMINATION: Tenant may terminate with two (2) months' written notice."
            ),
        )

    monkeypatch.setattr("app.main.generate_counter_clause", fake_generate)

    response = client.post(
        "/api/v1/counter-clause",
        json={
            "clause_id": "clause-4",
            "raw_text": (
                "4. DEPOSIT FORFEITURE: Tenant (940822-10-6142) forfeits 100% of Security "
                "and Utility Deposits plus 3 months penalty."
            ),
            "jurisdiction": "Malaysia",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["clause_id"] == "clause-4"
    assert body["pii_items_removed"] == 1
    assert "[MYKAD_REDACTED]" in body["redacted_text"]
    assert body["risk_level"] == "HIGH"
    assert body["inference_source"] == "CLOUD_GEMINI"
