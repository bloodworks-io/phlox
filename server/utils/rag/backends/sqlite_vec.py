"""
sqlite-vec backend for the vector store.
"""

from __future__ import annotations

import logging
import re
import sqlite3

from .base import ChunkData, SearchResult, VectorStoreBackend

logger = logging.getLogger(__name__)


def _safe_table_name(name: str) -> str:
    """Sanitise a collection name for use as a SQL table-name suffix."""
    return re.sub(r"[^a-z0-9_]", "", name.lower().replace(" ", "_"))


class SqliteVecBackend(VectorStoreBackend):
    """sqlite-vec implementation of the vector-store backend."""

    def __init__(self, db_path: str):
        import sqlite_vec

        self._db_path = db_path
        self._sqlite_vec = sqlite_vec
        self._init_schema()

    # Internal helpers

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self._db_path)
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA foreign_keys=ON")
        db.enable_load_extension(True)
        self._sqlite_vec.load(db)
        return db

    def _init_schema(self) -> None:
        """Create shared metadata tables if they don't exist."""
        from pathlib import Path

        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)

        db = self._connect()
        try:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS collections (
                    name            TEXT PRIMARY KEY,
                    embedding_model TEXT NOT NULL,
                    embedding_dim   INTEGER NOT NULL,
                    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS source_documents (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    collection_name TEXT NOT NULL REFERENCES collections(name) ON DELETE CASCADE,
                    filename        TEXT NOT NULL,
                    full_text       TEXT NOT NULL,
                    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(collection_name, filename)
                );

                CREATE TABLE IF NOT EXISTS chunks (
                    id                  TEXT PRIMARY KEY,
                    collection_name     TEXT NOT NULL REFERENCES collections(name) ON DELETE CASCADE,
                    source_document_id  INTEGER NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
                    chunk_index         INTEGER NOT NULL,
                    text                TEXT NOT NULL,
                    disease_name        TEXT,
                    focus_area          TEXT,
                    source              TEXT,
                    filename            TEXT
                );
                """
            )
            db.execute(
                "CREATE INDEX IF NOT EXISTS idx_chunks_collection ON chunks(collection_name)"
            )
            db.execute(
                "CREATE INDEX IF NOT EXISTS idx_chunks_source_doc ON chunks(source_document_id)"
            )
            db.commit()
        finally:
            db.close()

    # Collection lifecycle

    def list_collections(self) -> list[str]:
        db = self._connect()
        try:
            rows = db.execute("SELECT name FROM collections ORDER BY name").fetchall()
            return [r[0] for r in rows]
        except Exception as e:
            logger.error("Error listing collections: %s", e)
            return []
        finally:
            db.close()

    def create_collection(self, name: str, embedding_model: str, embedding_dim: int) -> None:
        safe = _safe_table_name(name)
        db = self._connect()
        try:
            db.execute(
                "INSERT OR IGNORE INTO collections (name, embedding_model, embedding_dim) "
                "VALUES (?, ?, ?)",
                (name, embedding_model, embedding_dim),
            )
            db.execute(
                f"CREATE VIRTUAL TABLE IF NOT EXISTS vec_{safe} USING vec0("
                f"chunk_id TEXT PRIMARY KEY, embedding float[{embedding_dim}] "
                f"distance_metric=cosine)"
            )
            db.commit()
        finally:
            db.close()

    def delete_collection(self, name: str) -> bool:
        safe = _safe_table_name(name)
        db = self._connect()
        try:
            db.execute(f"DROP TABLE IF EXISTS vec_{safe}")
            db.execute("DELETE FROM collections WHERE name = ?", (name,))
            db.commit()
            logger.info("Collection '%s' deleted", name)
            return True
        except Exception as e:
            logger.error("Error deleting collection '%s': %s", name, e)
            return False
        finally:
            db.close()

    def rename_collection(self, old_name: str, new_name: str) -> bool:
        old_safe = _safe_table_name(old_name)
        new_safe = _safe_table_name(new_name)
        db = self._connect()
        try:
            db.execute(f"ALTER TABLE vec_{old_safe} RENAME TO vec_{new_safe}")
            db.execute("UPDATE collections SET name = ? WHERE name = ?", (new_name, old_name))
            db.execute(
                "UPDATE chunks SET collection_name = ?, disease_name = ? "
                "WHERE collection_name = ?",
                (new_name, new_name, old_name),
            )
            db.execute(
                "UPDATE source_documents SET collection_name = ? WHERE collection_name = ?",
                (new_name, old_name),
            )
            db.commit()
            logger.info("Collection '%s' renamed to '%s'", old_name, new_name)
            return True
        except Exception as e:
            logger.error("Error renaming collection: %s", e)
            return False
        finally:
            db.close()

    def reset(self) -> None:
        from pathlib import Path

        Path(self._db_path).unlink(missing_ok=True)
        self._init_schema()

    # Document storage

    def store_source_document(self, collection_name: str, filename: str, full_text: str) -> int:
        db = self._connect()
        try:
            db.execute(
                "INSERT INTO source_documents (collection_name, filename, full_text) "
                "VALUES (?, ?, ?)",
                (collection_name, filename, full_text),
            )
            row_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
            db.commit()
            return row_id
        finally:
            db.close()

    def insert_chunks(self, chunks: list[ChunkData]) -> None:
        if not chunks:
            return

        safe = _safe_table_name(chunks[0].collection_name)
        db = self._connect()
        try:
            for c in chunks:
                db.execute(
                    "INSERT INTO chunks "
                    "(id, collection_name, source_document_id, chunk_index, text, "
                    "disease_name, focus_area, source, filename) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        c.id,
                        c.collection_name,
                        c.source_document_id,
                        c.chunk_index,
                        c.text,
                        c.disease_name,
                        c.focus_area,
                        c.source,
                        c.filename,
                    ),
                )
                db.execute(
                    f"INSERT INTO vec_{safe} (chunk_id, embedding) VALUES (?, ?)",
                    (c.id, self._sqlite_vec.serialize_float32(c.embedding)),
                )
            db.commit()
        finally:
            db.close()

    def get_files_for_collection(self, collection_name: str) -> list[str]:
        db = self._connect()
        try:
            rows = db.execute(
                "SELECT DISTINCT filename FROM chunks WHERE collection_name = ?",
                (collection_name,),
            ).fetchall()
            return [r[0] for r in rows if r[0]]
        except Exception as e:
            logger.error("Error retrieving files for '%s': %s", collection_name, e)
            return []
        finally:
            db.close()

    def delete_file_from_collection(self, collection_name: str, filename: str) -> bool:
        safe = _safe_table_name(collection_name)
        db = self._connect()
        try:
            rows = db.execute(
                "SELECT id FROM chunks WHERE collection_name = ? AND filename = ?",
                (collection_name, filename),
            ).fetchall()
            ids = [r[0] for r in rows]
            if ids:
                for chunk_id in ids:
                    db.execute(f"DELETE FROM vec_{safe} WHERE chunk_id = ?", (chunk_id,))
                db.execute(
                    "DELETE FROM chunks WHERE collection_name = ? AND filename = ?",
                    (collection_name, filename),
                )
                db.execute(
                    "DELETE FROM source_documents "
                    "WHERE collection_name = ? AND filename = ?",
                    (collection_name, filename),
                )
                db.commit()
                logger.info(
                    "Deleted %d chunks for file '%s' from collection '%s'",
                    len(ids),
                    filename,
                    collection_name,
                )
            return True
        except Exception as e:
            logger.error("Error deleting file from collection: %s", e)
            return False
        finally:
            db.close()

    # Similarity search

    def search(
        self, collection_name: str, query_embedding: list[float], n_results: int = 5
    ) -> list[SearchResult]:
        safe = _safe_table_name(collection_name)
        db = self._connect()
        try:
            vec_rows = db.execute(
                f"SELECT chunk_id, distance FROM vec_{safe} "
                f"WHERE embedding MATCH ? AND k = ?",
                (self._sqlite_vec.serialize_float32(query_embedding), n_results),
            ).fetchall()
        except Exception as e:
            logger.error("Error searching collection '%s': %s", collection_name, e)
            return []
        finally:
            db.close()

        if not vec_rows:
            return []

        # Fetch chunk metadata for matched IDs
        chunk_ids = [r[0] for r in vec_rows]
        distances = {r[0]: r[1] for r in vec_rows}

        db = self._connect()
        try:
            placeholders = ",".join("?" * len(chunk_ids))
            chunk_rows = db.execute(
                f"SELECT id, text, disease_name, focus_area, source, filename "
                f"FROM chunks WHERE id IN ({placeholders})",
                chunk_ids,
            ).fetchall()
        finally:
            db.close()

        chunk_map = {
            r[0]: SearchResult(
                chunk_id=r[0],
                text=r[1],
                distance=distances[r[0]],
                metadata={
                    "disease_name": r[2],
                    "focus_area": r[3],
                    "source": r[4],
                    "filename": r[5],
                },
            )
            for r in chunk_rows
            if r[0] in distances
        }

        # Preserve distance ordering from the vector query
        return [chunk_map[cid] for cid in chunk_ids if cid in chunk_map]

    # Re-embedding

    def get_chunk_texts(self, collection_name: str) -> list[tuple[str, str]]:
        db = self._connect()
        try:
            rows = db.execute(
                "SELECT id, text FROM chunks WHERE collection_name = ?",
                (collection_name,),
            ).fetchall()
            return [(r[0], r[1]) for r in rows]
        finally:
            db.close()

    def replace_embeddings(
        self,
        collection_name: str,
        model_name: str,
        dim: int,
        embeddings: list[tuple[str, list[float]]],
    ) -> int:
        safe = _safe_table_name(collection_name)
        db = self._connect()
        try:
            db.execute(f"DROP TABLE IF EXISTS vec_{safe}")
            db.execute(
                f"CREATE VIRTUAL TABLE vec_{safe} USING vec0("
                f"chunk_id TEXT PRIMARY KEY, embedding float[{dim}] "
                f"distance_metric=cosine)"
            )
            for chunk_id, embedding in embeddings:
                db.execute(
                    f"INSERT INTO vec_{safe} (chunk_id, embedding) VALUES (?, ?)",
                    (chunk_id, self._sqlite_vec.serialize_float32(embedding)),
                )
            db.execute(
                "UPDATE collections SET embedding_model = ?, embedding_dim = ? "
                "WHERE name = ?",
                (model_name, dim, collection_name),
            )
            db.commit()
            return len(embeddings)
        except Exception:
            logger.exception("Failed to replace embeddings for '%s'", collection_name)
            raise
        finally:
            db.close()

    # Metadata queries

    def list_sources(self) -> list[str]:
        db = self._connect()
        try:
            rows = db.execute(
                "SELECT DISTINCT source FROM chunks WHERE source IS NOT NULL"
            ).fetchall()
            return [r[0] for r in rows if r[0]]
        except Exception as e:
            logger.error("Error listing sources: %s", e)
            return []
        finally:
            db.close()
