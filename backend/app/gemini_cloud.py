import json
import time
from google import genai
from google.genai import types
from .config import settings
from .schemas import GeminiCounterClauseOutput

_client: genai.Client | None = None
_client_api_key: str | None = None


def _get_client() -> genai.Client:
    global _client, _client_api_key
    api_key = settings.gemini_api_key
    if not api_key or api_key == "MY_GEMINI_API_KEY":
        raise RuntimeError("GEMINI_API_KEY is not configured on the backend.")
    if _client is None or _client_api_key != api_key:
        _client = genai.Client(api_key=api_key)
        _client_api_key = api_key
    return _client


def _get_fallback_models() -> list[str]:
    candidates = [
        settings.gemini_cloud_model or "gemini-3.5-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-3.8-flash",
    ]
    return list(dict.fromkeys(candidates))


def generate_counter_clause(
    clause_id: str,
    redacted_text: str,
    jurisdiction: str,
) -> GeminiCounterClauseOutput:
    client = _get_client()
    prompt = (
        f"Jurisdiction: {jurisdiction}\n"
        f"Clause ID: {clause_id}\n\n"
        f"Redacted Clause Text:\n{redacted_text}\n\n"
        "State the core legal concern in 1-2 sentences and draft a concise, balanced, "
        "enforceable counter-clause. Preserve all [REDACTED] tokens verbatim."
    )
    config = types.GenerateContentConfig(
        system_instruction=(
            "You are senior legal counsel. Draft concise, direct legal redlines: "
            "a brief legal concern and a balanced, enforceable counter-clause. "
            "Preserve all [REDACTED] placeholders verbatim."
        ),
        temperature=0.2,
        max_output_tokens=650,
        response_mime_type="application/json",
        response_schema=GeminiCounterClauseOutput,
    )

    last_error: Exception | None = None
    response = None
    slept_on_429 = False

    for model_name in _get_fallback_models():
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
            break
        except Exception as exc:
            last_error = exc
            msg = str(exc)
            if "429" in msg and not slept_on_429:
                slept_on_429 = True
                time.sleep(0.15)
            # Any API error → try next model
            continue

    if response is None:
        raise last_error or RuntimeError("All Gemini fallback models failed.")

    payload = json.loads(response.text or "{}")
    return GeminiCounterClauseOutput.model_validate(payload)
