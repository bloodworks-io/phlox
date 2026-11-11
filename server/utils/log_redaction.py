"""Central log redaction (defence in depth).

``RedactingFilter`` is attached to the root logging handlers at startup
(server/server.py). It masks common identifiers that should never reach log
output even if a call site forgets: bearer tokens, MRN/UR numbers, email
addresses, and numeric/UUID segments of ``/api/...`` paths (plus their query
strings).

It does not modify the shared ``LogRecord``: when something must be redacted
it returns a redacted copy (Python 3.12+ handler-filter semantics), so other
handlers only see what their own filters allow.
"""

import logging
import re

_UUID = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"

_BEARER = re.compile(r"\b(Bearer)\s+[A-Za-z0-9._~+/=-]+", re.IGNORECASE)
_MRN = re.compile(r"\bMRN\s*[:#]?\s*\d+\b", re.IGNORECASE)
_UR = re.compile(r"\bUR\s*[:#]?\s*[A-Z]?\d{4,}[A-Z]?\b", re.IGNORECASE)
_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_API_PATH = re.compile(r"/api/[^\s'\"<>]*")
_ID_SEGMENT = re.compile(rf"/(?:\d+|{_UUID})(?=/|$)")


def _redact_api_path(match: re.Match) -> str:
    path = match.group(0).split("?", 1)[0]
    return _ID_SEGMENT.sub("/{id}", path)


def redact(text: str) -> str:
    """Return ``text`` with tokens, MRN/UR numbers, emails and path IDs masked."""
    text = _BEARER.sub(r"\1 [REDACTED]", text)
    text = _MRN.sub("MRN [REDACTED]", text)
    text = _UR.sub("UR [REDACTED]", text)
    text = _EMAIL.sub("[EMAIL]", text)
    return _API_PATH.sub(_redact_api_path, text)


class RedactingFilter(logging.Filter):
    """Handler filter that emits a redacted copy of records containing PHI/secrets."""

    def filter(self, record: logging.LogRecord) -> bool | logging.LogRecord:
        try:
            message = record.getMessage()
        except Exception:
            return True  # malformed format args: let logging report it as usual
        redacted = redact(message)
        if redacted == message:
            return True
        clean = logging.makeLogRecord(record.__dict__)
        clean.msg = redacted
        clean.args = None
        return clean


def install_redaction(logger: logging.Logger | None = None) -> None:
    """Attach a RedactingFilter to every handler of ``logger`` (root by default)."""
    target = logger or logging.getLogger()
    for handler in target.handlers:
        if not any(isinstance(f, RedactingFilter) for f in handler.filters):
            handler.addFilter(RedactingFilter())
