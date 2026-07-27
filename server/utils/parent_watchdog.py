"""Parent-PID watchdog: Python self-terminates if the Tauri parent dies.

Adapted from Voicebox (https://github.com/jamiepine/voicebox), backend/server.py.
Copyright (c) 2026 Voicebox Contributors. Licensed under the MIT License.

This thread polls the parent PID every 2s and SIGTERMs this process on detection.
"""

import logging
import os
import signal
import sys
import threading
import time

from server.constants import DATA_DIR, IS_DOCKER

_WATCHDOG_LOGGER = logging.getLogger("watchdog")


def _configure_logger() -> None:
    """Attach a file handler so we can debug post-mortem when the parent is dead."""
    if _WATCHDOG_LOGGER.handlers:
        return
    try:
        log_dir = DATA_DIR / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(log_dir / "watchdog.log")
        handler.setFormatter(logging.Formatter("%(asctime)s - %(message)s"))
        _WATCHDOG_LOGGER.addHandler(handler)
    except OSError:
        # File handler setup failed (read-only fs, permissions) — fall back to
        # whatever handlers the root logger has. Better to run silent than to
        # skip the watchdog entirely.
        pass
    _WATCHDOG_LOGGER.setLevel(logging.INFO)


def _is_pid_alive(pid: int) -> bool:
    """Check if a process with the given PID exists (cross-platform)."""
    try:
        if sys.platform == "win32":
            import ctypes

            kernel32 = ctypes.windll.kernel32
            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
            if handle:
                STILL_ACTIVE = 259
                exit_code = ctypes.c_ulong()
                result = kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))
                kernel32.CloseHandle(handle)
                if result and exit_code.value == STILL_ACTIVE:
                    return True
                _WATCHDOG_LOGGER.info("PID %d: exited with code %d", pid, exit_code.value)
                return False
            # OpenProcess failed — distinguish access-denied (process exists but
            # we can't open it) from not-found.
            error = ctypes.GetLastError()
            if error == 5:  # ERROR_ACCESS_DENIED
                return True
            _WATCHDOG_LOGGER.info("PID %d: OpenProcess failed, error=%d", pid, error)
            return False
        os.kill(pid, 0)
        return True
    except (OSError, PermissionError):
        return False


def _watch(parent_pid: int) -> None:
    _WATCHDOG_LOGGER.info(
        "Parent watchdog started, monitoring PID %d, server PID %d",
        parent_pid,
        os.getpid(),
    )
    # Bail out silently if parent is already gone on first check.
    if not _is_pid_alive(parent_pid):
        _WATCHDOG_LOGGER.warning(
            "Parent PID %d not found on first check — disabling watchdog", parent_pid
        )
        return

    while True:
        if not _is_pid_alive(parent_pid):
            _WATCHDOG_LOGGER.info("Parent process %d gone, shutting down server", parent_pid)
            if sys.platform == "win32":
                os._exit(0)
            os.kill(os.getpid(), signal.SIGTERM)
            return
        time.sleep(2)


def start_parent_watchdog(parent_pid: int) -> None:
    """Start a daemon thread that kills this process when the parent dies.

    No-op in Docker mode (container runtime supervises) and when parent_pid <= 0.
    """
    if IS_DOCKER:
        return
    if parent_pid <= 0:
        _WATCHDOG_LOGGER.warning(
            "parent_pid must be positive, got %d — skipping watchdog", parent_pid
        )
        return
    _configure_logger()
    threading.Thread(target=_watch, args=(parent_pid,), daemon=True).start()
