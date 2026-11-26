from app.redactor import scrub_pii


def test_scrubs_malaysian_mykad_and_phone():
    sample = "Tenant MyKad 940822-10-6142, Tel +6012-345-6789, Email tenant@example.my"
    result = scrub_pii(sample)
    assert "940822-10-6142" not in result.redacted_text
    assert "+6012-345-6789" not in result.redacted_text
    assert "tenant@example.my" not in result.redacted_text
    assert "[MYKAD_REDACTED]" in result.redacted_text
    assert "[PHONE_REDACTED]" in result.redacted_text
    assert "[EMAIL_REDACTED]" in result.redacted_text
    assert result.pii_items_removed == 3


def test_scrubs_bank_account_and_passport():
    sample = "Pay into Maybank Account No: 514011223344 or Passport No: A12345678."
    result = scrub_pii(sample)
    assert "514011223344" not in result.redacted_text
    assert "A12345678" not in result.redacted_text
    assert "[BANK_ACCT_REDACTED]" in result.redacted_text
    assert "[PASSPORT_REDACTED]" in result.redacted_text
    assert result.pii_items_removed == 2
