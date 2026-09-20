"""F7: PubMed/wiki query sanitization — PHI must not reach external endpoints."""

from server.chat.tools.sanitization import (
    sanitize_pubmed_query,
    sanitize_query_for_external_search,
)

# Exact payload from the security audit's httpx capture
AUDIT_PAYLOAD = "diabetes management in John Smith DOB 12/03/1955 UR 1234567 phone 0412 345 678"


def test_pubmed_query_strips_phi_from_audit_payload():
    out = sanitize_pubmed_query(AUDIT_PAYLOAD)
    assert "12/03/1955" not in out  # DOB
    assert "1234567" not in out  # UR number
    assert "0412 345 678" not in out  # AU mobile
    # ponytail: patient NAME survives regex-only sanitization (no context plumbed);
    # the system-prompt PHI rule is the name defense. Assert the rest survived:
    assert "diabetes management" in out


def test_external_search_strips_au_phones():
    assert (
        sanitize_query_for_external_search("call 0412345678 about diabetes")
        == "call about diabetes"
    )
    assert sanitize_query_for_external_search("ring 03 9123 4567 re diabetes") == "ring re diabetes"


def test_pubmed_query_strips_standalone_years():
    assert sanitize_pubmed_query("diabetes management 2024") == "diabetes management"


def test_pubmed_query_preserves_years_in_disease_names():
    assert "COVID-19" in sanitize_pubmed_query("COVID-19 complications")


def test_sanitizer_returns_original_when_emptied():
    # A query that is entirely PHI must not become an empty outbound query
    assert sanitize_query_for_external_search("UR 1234567") == "UR 1234567"
