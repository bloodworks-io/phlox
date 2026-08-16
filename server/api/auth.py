"""User authentication: first-run setup, login sessions, and user management."""

import hashlib
import logging
import re
import secrets
import time

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from server.database.repositories import users
from server.utils.current_user import current_user_id, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

AUTH_LOGIN_PATH = "/api/auth/login"
AUTH_PUBLIC_PATHS = {"/api/auth/status", "/api/auth/login", "/api/auth/setup"}

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1

MIN_PASSWORD_LEN = 8
_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,64}$")

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 30
# Per-username in-memory lockout; shared dict keyed by username; might need to move to table in future
_failed: dict[str, list] = {}


class LoginRequest(BaseModel):
    username: str
    password: str


class SetupRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "clinician"


class PasswordResetRequest(BaseModel):
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class DisableRequest(BaseModel):
    disabled: bool


def _hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P)


def _new_credentials(password: str) -> tuple[bytes, bytes]:
    salt = secrets.token_bytes(16)
    return _hash_password(password, salt), salt


def _validate_credentials(username: str, password: str) -> None:
    if not _USERNAME_RE.match(username):
        raise HTTPException(422, "Username must be 3-64 chars: letters, digits, . _ -")
    if len(password) < MIN_PASSWORD_LEN:
        raise HTTPException(422, f"Password must be at least {MIN_PASSWORD_LEN} characters")
    if len(password) < 12:
        logger.warning("Password shorter than 12 characters - recommend a stronger one")


def _locked_out(username: str) -> bool:
    state = _failed.get(username)
    return bool(state) and time.monotonic() < state[1]


def _create_session(user_id: int) -> str:
    """Single session mint point — password login, setup, and future OIDC all land here."""
    return users.create_session(user_id)


def _require_admin() -> None:
    user = get_current_user()
    if user is None or not user.is_admin:
        raise HTTPException(403, "Admin role required")


def _me_or_admin(user_id: int) -> None:
    me = get_current_user()
    if me is None or (me.id != user_id and not me.is_admin):
        raise HTTPException(403, "Not permitted")


@router.get("/status")
def auth_status():
    """Unauthenticated: does this instance need first-run setup?"""
    return {"needs_setup": users.count_real_users() == 0}


@router.post("/setup")
def setup(body: SetupRequest):
    """First-run admin creation. Refuses once any real user exists."""
    if users.count_real_users() > 0:
        return JSONResponse(status_code=403, content={"detail": "Setup already completed"})
    _validate_credentials(body.username, body.password)
    password_hash, salt = _new_credentials(body.password)
    user_id = users.create_user(body.username, password_hash, salt, role="admin")
    users.claim_unowned(user_id)
    logger.info("Admin '%s' created via first-run setup", body.username)
    return {"token": _create_session(user_id), "username": body.username, "role": "admin"}


@router.post("/login")
def login(body: LoginRequest):
    if _locked_out(body.username):
        retry = int(_failed[body.username][1] - time.monotonic())
        return JSONResponse(
            status_code=423, content={"detail": f"Locked: too many failures. Retry in {retry}s."}
        )

    user = users.get_user_by_username(body.username)
    ok = False
    if user and user["password_hash"] is not None and user["salt"] is not None:
        candidate = _hash_password(body.password, user["salt"])
        ok = secrets.compare_digest(candidate, user["password_hash"])

    if not ok or (user and user["disabled"]):
        count, _ = _failed.get(body.username, [0, 0.0])
        count += 1
        if count >= MAX_ATTEMPTS:
            _failed[body.username] = [0, time.monotonic() + LOCKOUT_SECONDS]
            logger.warning("Login for '%s' locked out for %ss", body.username, LOCKOUT_SECONDS)
        else:
            _failed[body.username] = [count, 0.0]
        return JSONResponse(status_code=401, content={"detail": "Invalid username or password"})

    _failed.pop(body.username, None)
    assert user is not None  # noqa: S101 - ok=True implies a matched user
    return {
        "token": _create_session(user["id"]),
        "username": user["username"],
        "role": user["role"],
    }


@router.post("/logout")
def logout(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        users.delete_session(auth_header[7:])
    return {"ok": True}


@router.get("/me")
def me():
    user = get_current_user()
    if user is None:
        raise HTTPException(401, "Not authenticated")
    return {"id": user.id, "username": user.username, "role": user.role}


@router.post("/change-password")
def change_password(body: ChangePasswordRequest):
    me_id = current_user_id()
    if me_id is None:
        raise HTTPException(401, "Not authenticated")
    user = users.get_user_by_id(me_id)
    if not user or user["password_hash"] is None:
        raise HTTPException(422, "This account has no password")
    candidate = _hash_password(body.current_password, user["salt"])
    if not secrets.compare_digest(candidate, user["password_hash"]):
        raise HTTPException(401, "Current password incorrect")
    if len(body.new_password) < MIN_PASSWORD_LEN:
        raise HTTPException(422, f"Password must be at least {MIN_PASSWORD_LEN} characters")
    password_hash, salt = _new_credentials(body.new_password)
    users.set_password(me_id, password_hash, salt)
    return {"ok": True}


@router.get("/users")
def get_users():
    _require_admin()
    return users.list_users()


@router.post("/users")
def create_user(body: CreateUserRequest):
    _require_admin()
    if body.role not in ("admin", "clinician"):
        raise HTTPException(422, "role must be 'admin' or 'clinician'")
    _validate_credentials(body.username, body.password)
    if users.get_user_by_username(body.username):
        raise HTTPException(409, "Username already taken")
    password_hash, salt = _new_credentials(body.password)
    user_id = users.create_user(body.username, password_hash, salt, role=body.role)
    return {"id": user_id, "username": body.username, "role": body.role}


@router.post("/users/{user_id}/password")
def reset_password(user_id: int, body: PasswordResetRequest):
    _require_admin()
    if not users.get_user_by_id(user_id):
        raise HTTPException(404, "User not found")
    if len(body.password) < MIN_PASSWORD_LEN:
        raise HTTPException(422, f"Password must be at least {MIN_PASSWORD_LEN} characters")
    password_hash, salt = _new_credentials(body.password)
    users.set_password(user_id, password_hash, salt)
    return {"ok": True}


@router.post("/users/{user_id}/disable")
def disable_user(user_id: int, body: DisableRequest):
    _require_admin()
    me = get_current_user()
    if me and me.id == user_id and body.disabled:
        raise HTTPException(422, "Cannot disable your own account")
    if not users.get_user_by_id(user_id):
        raise HTTPException(404, "User not found")
    users.set_disabled(user_id, body.disabled)
    return {"ok": True}


def reset_for_tests() -> None:
    """Clear lockout state between tests."""
    _failed.clear()
    from server.database.core.connection import get_db

    with get_db().transaction() as cursor:
        cursor.execute("DELETE FROM sessions")
        cursor.execute("DELETE FROM users WHERE username != ?", (users.IMPLICIT_ADMIN_USERNAME,))
