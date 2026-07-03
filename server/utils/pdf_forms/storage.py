"""
Storage layer for PDF form templates.
"""

import json
import logging
import uuid
from datetime import UTC, datetime

from server.database.core.documents_db import get_documents_connection

logger = logging.getLogger(__name__)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS pdf_form_templates (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    pdf_file_name   TEXT NOT NULL,
    pdf_data        BLOB NOT NULL,
    page_count      INTEGER NOT NULL,
    page_heights    TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pdf_form_fields (
    id              TEXT PRIMARY KEY,
    template_id     TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    field_type      TEXT NOT NULL,
    required        INTEGER DEFAULT 0,
    page_number     INTEGER NOT NULL,
    x               REAL NOT NULL,
    y               REAL NOT NULL,
    width           REAL NOT NULL,
    height          REAL NOT NULL,
    font_size       INTEGER DEFAULT 12,
    FOREIGN KEY (template_id) REFERENCES pdf_form_templates(id) ON DELETE CASCADE
);
"""


def _row_to_template(row: dict) -> dict:
    """Convert a DB row (without pdf_data) to a template dict."""
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "pdf_file_name": row["pdf_file_name"],
        "page_count": row["page_count"],
        "page_heights": json.loads(row["page_heights"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _row_to_field(row: dict) -> dict:
    """Convert a DB row to a field dict."""
    return {
        "id": row["id"],
        "template_id": row["template_id"],
        "name": row["name"],
        "description": row["description"],
        "field_type": row["field_type"],
        "required": bool(row["required"]),
        "page_number": row["page_number"],
        "x": row["x"],
        "y": row["y"],
        "width": row["width"],
        "height": row["height"],
        "font_size": row["font_size"],
    }


class PDFFormStore:
    """CRUD operations for PDF form templates and fields."""

    def __init__(self):
        self._db = get_documents_connection()
        self._db.executescript(_SCHEMA)
        self._db.commit()
        logger.info("PDFFormStore initialised (schema ensured)")

    def create_template(
        self,
        name: str,
        pdf_file_name: str,
        pdf_data: bytes,
        page_count: int,
        page_heights: list[float],
        description: str = "",
    ) -> dict:
        """Create a new template.  Returns the template dict (no pdf_data)."""
        now = datetime.now(UTC).isoformat()
        tmpl_id = str(uuid.uuid4())
        db = self._db
        db.execute(
            """INSERT INTO pdf_form_templates
               (id, name, description, pdf_file_name, pdf_data,
                page_count, page_heights, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                tmpl_id,
                name,
                description,
                pdf_file_name,
                pdf_data,
                page_count,
                json.dumps(page_heights),
                now,
                now,
            ),
        )
        db.commit()
        logger.info("Created template %s (%s)", tmpl_id, name)
        tmpl = self.get_template(tmpl_id)
        assert tmpl is not None, "Template not found immediately after insert"
        return tmpl

    def list_templates(self) -> list[dict]:
        """Return all templates (without pdf_data or fields)."""
        db = self._db
        rows = db.execute(
            """SELECT id, name, description, pdf_file_name,
                      page_count, page_heights, created_at, updated_at
               FROM pdf_form_templates
               ORDER BY created_at DESC"""
        ).fetchall()
        col_names = [
            d[0]
            for d in db.execute(
                "SELECT id, name, description, pdf_file_name, "
                "page_count, page_heights, created_at, updated_at "
                "FROM pdf_form_templates LIMIT 0"
            ).description
        ]
        templates = [_row_to_template(dict(zip(col_names, r, strict=True))) for r in rows]

        # Attach field counts
        for tmpl in templates:
            count = db.execute(
                "SELECT COUNT(*) FROM pdf_form_fields WHERE template_id = ?",
                (tmpl["id"],),
            ).fetchone()[0]
            tmpl["field_count"] = count

        return templates

    def get_template(self, template_id: str) -> dict | None:
        """Return a single template with its fields (no pdf_data)."""
        db = self._db
        row = db.execute(
            """SELECT id, name, description, pdf_file_name,
                      page_count, page_heights, created_at, updated_at
               FROM pdf_form_templates
               WHERE id = ?""",
            (template_id,),
        ).fetchone()
        if row is None:
            return None

        col_names = [
            d[0]
            for d in db.execute(
                "SELECT id, name, description, pdf_file_name, "
                "page_count, page_heights, created_at, updated_at "
                "FROM pdf_form_templates LIMIT 0"
            ).description
        ]
        template = _row_to_template(dict(zip(col_names, row, strict=True)))

        # Attach fields
        field_rows = db.execute(
            "SELECT * FROM pdf_form_fields WHERE template_id = ? ORDER BY page_number, y DESC, x",
            (template_id,),
        ).fetchall()
        field_cols = [d[0] for d in db.execute("SELECT * FROM pdf_form_fields LIMIT 0").description]
        template["fields"] = [
            _row_to_field(dict(zip(field_cols, r, strict=True))) for r in field_rows
        ]
        return template

    def get_template_pdf(self, template_id: str) -> bytes | None:
        """Return the raw PDF bytes for a template."""
        row = self._db.execute(
            "SELECT pdf_data FROM pdf_form_templates WHERE id = ?",
            (template_id,),
        ).fetchone()
        return row[0] if row else None

    def replace_pdf(
        self,
        template_id: str,
        pdf_file_name: str,
        pdf_data: bytes,
        page_count: int,
        page_heights: list[float],
    ) -> dict | None:
        """Replace the PDF bytes of an existing template, keeping its fields.

        Caller must ensure page geometry matches the original; this method does
        not validate dimensions.
        """
        now = datetime.now(UTC).isoformat()
        cursor = self._db.execute(
            """UPDATE pdf_form_templates
               SET pdf_data = ?, pdf_file_name = ?, page_count = ?,
                   page_heights = ?, updated_at = ?
               WHERE id = ?""",
            (
                pdf_data,
                pdf_file_name,
                page_count,
                json.dumps(page_heights),
                now,
                template_id,
            ),
        )
        self._db.commit()
        if cursor.rowcount == 0:
            return None
        logger.info("Replaced PDF for template %s", template_id)
        return self.get_template(template_id)

    def delete_template(self, template_id: str) -> bool:
        """Delete a template and its fields (CASCADE)."""
        cursor = self._db.execute(
            "DELETE FROM pdf_form_templates WHERE id = ?",
            (template_id,),
        )
        self._db.commit()
        deleted = cursor.rowcount > 0
        if deleted:
            logger.info("Deleted template %s", template_id)
        return deleted

    def update_fields(self, template_id: str, fields: list[dict]) -> list[dict]:
        """Replace all fields for a template.

        Each field dict should contain:
            name, description, field_type, required, page_number,
            x, y, width, height, font_size
        Returns the newly inserted field dicts (with ids).
        """
        db = self._db
        # Verify template exists
        exists = db.execute(
            "SELECT 1 FROM pdf_form_templates WHERE id = ?",
            (template_id,),
        ).fetchone()
        if not exists:
            raise ValueError(f"Template {template_id} not found")

        # Delete existing fields
        db.execute("DELETE FROM pdf_form_fields WHERE template_id = ?", (template_id,))

        # Insert new fields
        result = []
        for field in fields:
            field_id = str(uuid.uuid4())
            db.execute(
                """INSERT INTO pdf_form_fields
                   (id, template_id, name, description, field_type,
                    required, page_number, x, y, width, height, font_size)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    field_id,
                    template_id,
                    field["name"],
                    field.get("description", ""),
                    field["field_type"],
                    int(field.get("required", False)),
                    field["page_number"],
                    field["x"],
                    field["y"],
                    field["width"],
                    field["height"],
                    field.get("font_size", 12),
                ),
            )
            result.append(
                {
                    "id": field_id,
                    "template_id": template_id,
                    **{
                        k: field.get(k, v)
                        for k, v in {
                            "name": "",
                            "description": "",
                            "field_type": "text",
                            "required": False,
                            "page_number": 1,
                            "x": 0.0,
                            "y": 0.0,
                            "width": 0.0,
                            "height": 0.0,
                            "font_size": 12,
                        }.items()
                    },
                }
            )

        # Update timestamp
        now = datetime.now(UTC).isoformat()
        db.execute(
            "UPDATE pdf_form_templates SET updated_at = ? WHERE id = ?",
            (now, template_id),
        )
        db.commit()
        logger.info("Updated %d fields for template %s", len(result), template_id)
        return result
