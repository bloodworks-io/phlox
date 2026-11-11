"""Migration v11: pseudonymous subject reference on audit_log.

The audit path column now stores the route template instead of the raw URL,
so patient/note IDs no longer appear in audit_log. Accountability is kept via
``subject_ref``: a keyed HMAC-SHA256 of the subject ID (see
server/database/repositories/audit.py). Existing rows are not rewritten.
"""


def migrate(cursor, _db):
    """Add subject_ref column and index to audit_log."""
    cursor.execute("ALTER TABLE audit_log ADD COLUMN subject_ref TEXT")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_subject_ref ON audit_log(subject_ref)")
