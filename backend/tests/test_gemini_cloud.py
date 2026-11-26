import json
from types import SimpleNamespace
from app import gemini_cloud
from app.config import settings


def test_default_model_and_fallback_order(monkeypatch):
    monkeypatch.setattr(settings, "gemini_cloud_model", "gemini-3.5-flash")
    assert gemini_cloud._get_fallback_models() == [
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-3.8-flash",
    ]


def test_singleton_client_and_fast_503_failover(monkeypatch):
    created_clients = []
    called_models = []
    sleep_calls = []

    class FakeModels:
        def generate_content(self, *, model, contents, config):
            called_models.append((model, config))
            if model == "gemini-3.5-flash":
                raise RuntimeError("503 UNAVAILABLE")
            payload = {
                "risk_level": "HIGH",
                "legal_concern": "Asymmetric forfeiture.",
                "suggested_counter_clause": "Balanced notice period.",
            }
            return SimpleNamespace(text=json.dumps(payload))

    class FakeClient:
        def __init__(self, api_key: str):
            created_clients.append(api_key)
            self.models = FakeModels()

    monkeypatch.setattr(settings, "gemini_api_key", "test-key-123")
    monkeypatch.setattr(settings, "gemini_cloud_model", "gemini-3.5-flash")
    monkeypatch.setattr(gemini_cloud, "_client", None)
    monkeypatch.setattr(gemini_cloud, "_client_api_key", None)
    monkeypatch.setattr(gemini_cloud.genai, "Client", FakeClient)
    monkeypatch.setattr(gemini_cloud.time, "sleep", lambda s: sleep_calls.append(s))

    res1 = gemini_cloud.generate_counter_clause("clause-1", "Tenant forfeits deposit.", "Malaysia")
    res2 = gemini_cloud.generate_counter_clause("clause-2", "Landlord may enter anytime.", "Malaysia")

    assert len(created_clients) == 1
    assert res1.risk_level == "HIGH"
    assert res2.risk_level == "HIGH"
    assert [m for m, _ in called_models] == [
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
    ]
    assert sleep_calls == []

    _, cfg = called_models[0]
    assert cfg.temperature == 0.2
    assert cfg.max_output_tokens == 650


def test_429_sleeps_at_most_once_150ms(monkeypatch):
    sleep_calls = []
    called_models = []

    class FakeModels:
        def generate_content(self, *, model, contents, config):
            called_models.append(model)
            if model in ("gemini-3.5-flash", "gemini-3.5-flash-lite"):
                raise RuntimeError("429 RESOURCE_EXHAUSTED")
            payload = {
                "risk_level": "MEDIUM",
                "legal_concern": "Uncapped fee.",
                "suggested_counter_clause": "Capped fee.",
            }
            return SimpleNamespace(text=json.dumps(payload))

    class FakeClient:
        def __init__(self, api_key: str):
            self.models = FakeModels()

    monkeypatch.setattr(settings, "gemini_api_key", "test-key-456")
    monkeypatch.setattr(settings, "gemini_cloud_model", "gemini-3.5-flash")
    monkeypatch.setattr(gemini_cloud, "_client", None)
    monkeypatch.setattr(gemini_cloud, "_client_api_key", None)
    monkeypatch.setattr(gemini_cloud.genai, "Client", FakeClient)
    monkeypatch.setattr(gemini_cloud.time, "sleep", lambda s: sleep_calls.append(s))

    res = gemini_cloud.generate_counter_clause("clause-3", "Unlimited late fee.", "Malaysia")
    assert res.risk_level == "MEDIUM"
    assert called_models == ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"]
    assert sleep_calls == [0.15]
