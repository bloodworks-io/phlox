"""Request-scoped user identity."""

from contextvars import ContextVar
from typing import Any

from fastapi import HTTPException


class CurrentUser:
    __slots__ = ("id", "username", "role")

    def __init__(self, id: int, username: str, role: str):
        self.id = id
        self.username = username
        self.role = role

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


_current_user: ContextVar[CurrentUser | None] = ContextVar("current_user", default=None)


def set_current_user(user: CurrentUser | None) -> None:
    _current_user.set(user)


def get_current_user() -> CurrentUser | None:
    return _current_user.get()


def current_user_id() -> int | None:
    user = _current_user.get()
    return user.id if user else None


def is_admin() -> bool:
    user = _current_user.get()
    return user is None or user.is_admin


def scoped(column: str) -> tuple[str, list[Any]]:
    """SQL predicate limiting rows to the current user.

    Returns ``(" AND col = ?", [uid])`` for a clinician, ``("", [])``
    (unrestricted) for admins and internal calls.
    """
    user = _current_user.get()
    if user is None or user.is_admin:
        return "", []
    return f" AND {column} = ?", [user.id]


def scoped_or_shared(column: str) -> tuple[str, list[Any]]:
    """Like :func:`scoped` but NULL owner rows (system/shared) stay visible."""
    user = _current_user.get()
    if user is None or user.is_admin:
        return "", []
    return f" AND ({column} IS NULL OR {column} = ?)", [user.id]


def require_admin() -> None:
    """Raise 403 unless the current user is an admin.

    Internal calls (no request context) are allowed — scheduler/background
    maintenance paths and tests. The API middleware guarantees a user for
    every HTTP request, so this never fires unauthenticated on the HTTP path.
    """
    user = _current_user.get()
    if user is not None and not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin role required")
