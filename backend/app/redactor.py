import re
from dataclasses import dataclass

MYKAD_RE = re.compile(r"\b\d{6}-\d{2}-\d{4}\b")
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
CARD_RE = re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b")
BANK_CONTEXT_RE = re.compile(
    r"\b((?:(?:Maybank|CIMB|Public Bank|RHB|Hong Leong|AmBank|UOB|OCBC|HSBC|Bank)\s+)?(?:Account|Acct|A/C|Maybank|CIMB|Public Bank|RHB|Hong Leong|AmBank|UOB|OCBC|HSBC|Bank)\s*(?:No\.?|Number|#)?\s*:?\s*)(\d[\d\s-]{8,18}\d)\b",
    re.IGNORECASE,
)
PASSPORT_PREFIX_RE = re.compile(
    r"\b(Passport(?:\s*(?:No\.?|Number|#))?\s*:?\s*)([A-Z]{1,2}\d{7,8})\b",
    re.IGNORECASE,
)
GENERIC_PASSPORT_RE = re.compile(r"\b[AHK]\d{7,8}\b")
SSM_REG_RE = re.compile(r"\b(?:\d{6}-[A-Z]|20\d{10})\b")
PHONE_RE = re.compile(
    r"(?:\+?6?01[0-9][-\s]?\d{3,4}[-\s]?\d{4}|\+\d{1,3}[-\s]?\d{1,4}[-\s]?\d{3,4}[-\s]?\d{3,4}|\b0[3-9][-\s]?\d{7,8}\b)"
)


@dataclass
class ScrubResult:
    redacted_text: str
    pii_items_removed: int


def scrub_pii(text: str) -> ScrubResult:
    count = 0

    def _sub(pattern: re.Pattern[str], replacement: str, target: str) -> str:
        nonlocal count
        result, n = pattern.subn(replacement, target)
        count += n
        return result

    cleaned = _sub(MYKAD_RE, "[MYKAD_REDACTED]", text)
    cleaned = _sub(EMAIL_RE, "[EMAIL_REDACTED]", cleaned)
    cleaned = _sub(CARD_RE, "[CARD_REDACTED]", cleaned)

    def _bank_repl(match: re.Match[str]) -> str:
        nonlocal count
        count += 1
        return f"{match.group(1)}[BANK_ACCT_REDACTED]"

    cleaned = BANK_CONTEXT_RE.sub(_bank_repl, cleaned)

    def _passport_repl(match: re.Match[str]) -> str:
        nonlocal count
        count += 1
        return f"{match.group(1)}[PASSPORT_REDACTED]"

    cleaned = PASSPORT_PREFIX_RE.sub(_passport_repl, cleaned)
    cleaned = _sub(GENERIC_PASSPORT_RE, "[PASSPORT_REDACTED]", cleaned)
    cleaned = _sub(SSM_REG_RE, "[REG_ID_REDACTED]", cleaned)
    cleaned = _sub(PHONE_RE, "[PHONE_REDACTED]", cleaned)

    return ScrubResult(redacted_text=cleaned, pii_items_removed=count)
