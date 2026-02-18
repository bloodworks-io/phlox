"""Database backup functionality for Phlox.

Provides automatic backup of the SQLite database before migrations run,
with rotation to prevent disk space issues.
"""

import logging
import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from server.constants import CHANGELOG_PATH

# Configuration
MAX_BACKUPS = 3  # Keep last 3 backups
BACKUP_SUBDIR = "backups"  # Subdirectory name within data directory


def _get_app_version() -> str:
    """Get the current app version from CHANGELOG.md."""
    try:
        with open(CHANGELOG_PATH, "r") as f:
            changelog = f.read()
        match = re.search(r"## \[(.*?)\].*?\n", changelog)
        if match:
            return match.group(1)
    except Exception as e:
        logging.warning(f"Could not read version from CHANGELOG: {e}")
    return "unknown"


def create_backup(db_path: str, db_dir: Path) -> Optional[str]:
    """
    Create a backup of the database file before migrations.

    Args:
        db_path: Full path to the database file
        db_dir: Parent directory of the database (Path object)

    Returns:
        Path to backup file if successful, None if failed or no DB exists
    """
    # Skip if database doesn't exist yet (first run)
    if not os.path.exists(db_path):
        logging.info("No existing database to backup (first run)")
        return None

    try:
        # Create backup directory
        backup_dir = db_dir / BACKUP_SUBDIR
        backup_dir.mkdir(parents=True, exist_ok=True)

        # Generate backup filename with version and timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        db_name = os.path.basename(db_path)
        version = _get_app_version()
        backup_name = f"{db_name}.v{version}.{timestamp}.bak"
        backup_path = backup_dir / backup_name

        # Copy the database file (it's already encrypted)
        shutil.copy2(db_path, backup_path)

        logging.info(f"Database backup created: {backup_path}")

        # Rotate old backups
        _rotate_backups(backup_dir, db_name)

        return str(backup_path)

    except Exception as e:
        # Log warning but don't block startup
        logging.warning(f"Failed to create database backup: {e}")
        return None


def _rotate_backups(backup_dir: Path, db_name: str) -> None:
    """
    Remove old backups, keeping only the most recent MAX_BACKUPS.

    Args:
        backup_dir: Directory containing backups
        db_name: Original database filename to match backups
    """
    try:
        # Find all backups for this database, sorted by modification time (newest first)
        pattern = f"{db_name}.*.bak"
        backups = sorted(
            backup_dir.glob(pattern),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )

        # Remove backups beyond our limit
        for old_backup in backups[MAX_BACKUPS:]:
            old_backup.unlink()
            logging.info(f"Removed old backup: {old_backup}")

    except Exception as e:
        logging.warning(f"Failed to rotate backups: {e}")


def list_backups(db_dir: Path) -> list:
    """
    List all available backups.

    Args:
        db_dir: Parent directory of the database

    Returns:
        List of backup file info dicts
    """
    backup_dir = db_dir / BACKUP_SUBDIR
    if not backup_dir.exists():
        return []

    backups = []
    for backup_file in sorted(backup_dir.glob("*.bak"), reverse=True):
        stat = backup_file.stat()
        backups.append(
            {
                "path": str(backup_file),
                "name": backup_file.name,
                "size": stat.st_size,
                "created": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            }
        )

    return backups
