import hashlib
import logging
import secrets
import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from server.utils.local_request_token import get_request_token, set_request_token

logger = logging.getLogger(__name__)

router = APIRouter()

AUTH_LOGIN_PATH = "/api/auth/login"

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1

_salt: bytes | None = None
_verifier: bytes | None = None

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 30
_failed_attempts = 0
_locked_until = 0.0


class LoginRequest(BaseModel):
    passphrase: str


def init_passphrase_auth(passphrase: str) -> None:
    """Derive the scrypt verifier and mint the request token."""
    global _salt, _verifier
    _salt = secrets.token_bytes(16)
    _verifier = _hash_passphrase(passphrase, _salt)
    set_request_token(secrets.token_hex(32))
    logger.info("Passphrase auth enabled (login required at %s)", AUTH_LOGIN_PATH)


def _hash_passphrase(passphrase: str, salt: bytes) -> bytes:
    return hashlib.scrypt(passphrase.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P)


def _locked_out() -> bool:
    return time.monotonic() < _locked_until


@router.post("/login")
def login(body: LoginRequest):
    global _failed_attempts, _locked_until

    if _verifier is None or _salt is None:
        return _deny(status=503)

    if _locked_out():
        return _deny(status=423)

    assert _salt is not None and _verifier is not None  # noqa: S101 - narrowed above
    candidate = _hash_passphrase(body.passphrase, _salt)
    if not secrets.compare_digest(candidate, _verifier):
        _failed_attempts += 1
        if _failed_attempts >= MAX_ATTEMPTS:
            _locked_until = time.monotonic() + LOCKOUT_SECONDS
            _failed_attempts = 0
            logger.warning("Login locked out for %ss after repeated failures", LOCKOUT_SECONDS)
        return _deny()

    _failed_attempts = 0
    token = get_request_token()
    if not token:  # unreachable: init_passphrase_auth always sets one
        return _deny(status=503)
    return {"token": token}


def _deny(status: int = 401):
    if status == 423:
        detail = (
            f"Locked: too many failed attempts. Retry in {int(_locked_until - time.monotonic())}s."
        )
    elif status == 503:
        detail = "Passphrase auth not configured"
    else:
        detail = "Invalid passphrase"
    return JSONResponse(status_code=status, content={"detail": detail})


def reset_for_tests() -> None:
    """Clear verifier, token, and lockout state between tests."""
    global _salt, _verifier, _failed_attempts, _locked_until
    _salt = None
    _verifier = None
    _failed_attempts = 0
    _locked_until = 0.0
    set_request_token(None)
